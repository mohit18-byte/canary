/**
 * Scan Engine — orchestrates the full scan pipeline
 *
 * Runs providers SEQUENTIALLY, emitting SSE events at each step.
 * Supports cancellation via AbortSignal — propagated to TinyFish runs.
 */

import { scrapeProvider } from "./scraper";
import type { DeprecationEntry } from "./scraper";
import { diffChangelog, storeSnapshot } from "./diff-engine";
import { classifyChanges } from "./ai-classifier";
import { sendAlertEmail } from "./email-alerter";
import { supabase } from "./supabase";
import type { ChangelogSnapshot } from "@/types";
import type { ClassifiedChange } from "./ai-classifier";

// ─── Persistence Helper ─────────────────────────────────

async function saveClassifiedChanges(
  scanId: string,
  providerId: string,
  providerName: string,
  changes: ClassifiedChange[]
): Promise<void> {
  if (changes.length === 0) return;

  const rows = changes.map((c) => ({
    scan_id: scanId,
    provider_id: providerId,
    provider_name: providerName,
    title: c.title,
    date: c.date,
    source: c.source,
    change_type: c.change_type,
    urgency: c.urgency,
    impact: c.impact,
    action_required: c.action_required,
    suggested_fix: c.suggested_fix ?? "",
    code_example: c.code_example ?? "",
    timeline: c.timeline,
  }));

  const { error } = await supabase.from("changes").insert(rows);
  if (error) {
    console.error(`[scan-engine] ⚠️ Failed to persist changes for ${providerName}:`, error.message);
  } else {
    console.log(`[scan-engine] ✅ Saved ${rows.length} changes for ${providerName}`);
  }
}

// ─── Types ───────────────────────────────────────────────

export interface ScanEvent {
  type:
    | "scan:start"
    | "provider:start"
    | "provider:scrape"
    | "provider:deprecation"
    | "provider:diff"
    | "provider:classify"
    | "provider:complete"
    | "provider:error"
    | "scan:complete"
    | "scan:cancelled";
  provider?: string;
  data?: unknown;
  timestamp: string;
}

export interface ProviderScanResult {
  provider: string;
  success: boolean;
  durationMs: number;
  entriesScraped: number;
  newEntries: number;
  classified: ClassifiedChange[];
  error?: string;
}

export interface ScanResult {
  scanId: string;
  totalDurationMs: number;
  providers: ProviderScanResult[];
  emailSent: boolean;
  cancelled?: boolean;
}

interface ProviderInput {
  id: string;
  name: string;
  slug: string;
  changelog_url: string;
  deprecation_url?: string | null;
}

// ─── Cancellation Helper ────────────────────────────────

class ScanCancelledError extends Error {
  constructor() {
    super("Scan cancelled");
    this.name = "ScanCancelledError";
  }
}

function checkCancelled(signal?: AbortSignal) {
  if (signal?.aborted) throw new ScanCancelledError();
}

// ─── Engine ──────────────────────────────────────────────

/**
 * Run a full scan for the given providers SEQUENTIALLY.
 * Calls `onEvent` for each SSE event to enable real-time streaming.
 * Pass an AbortSignal to support cancellation.
 */
export async function runScanPipeline(
  providers: ProviderInput[],
  onEvent: (event: ScanEvent) => void,
  signal?: AbortSignal
): Promise<ScanResult> {
  const overallStart = Date.now();

  // Create scan record
  const { data: scan, error: scanError } = await supabase
    .from("scans")
    .insert({
      status: "running",
      provider_ids: providers.map((p) => p.id),
    })
    .select()
    .single();

  if (scanError || !scan) {
    throw new Error(`Failed to create scan: ${scanError?.message}`);
  }

  onEvent({
    type: "scan:start",
    data: {
      scanId: scan.id,
      providerCount: providers.length,
      providers: providers.map((p) => p.name),
    },
    timestamp: new Date().toISOString(),
  });

  const results: ProviderScanResult[] = [];
  const allClassified: ClassifiedChange[] = [];
  let wasCancelled = false;

  // Run providers SEQUENTIALLY
  for (const provider of providers) {
    // Check cancellation before each provider
    if (signal?.aborted) {
      console.log(`[scan-engine] 🛑 Cancelled before ${provider.name}`);
      wasCancelled = true;
      break;
    }

    const providerStart = Date.now();

    onEvent({
      type: "provider:start",
      provider: provider.name,
      data: { url: provider.changelog_url },
      timestamp: new Date().toISOString(),
    });

    try {
      // Step 1: Scrape (passes signal to TinyFish)
      checkCancelled(signal);
      const scrapeResult = await scrapeProvider({
        name: provider.name,
        slug: provider.slug,
        changelog_url: provider.changelog_url,
        deprecation_url: provider.deprecation_url ?? null,
        status_url: null,
      }, signal);

      checkCancelled(signal);

      if (!scrapeResult.changelog.success || !scrapeResult.changelog.data) {
        throw new Error(scrapeResult.changelog.error || "Scrape failed");
      }

      const changelogData = scrapeResult.changelog.data as ChangelogSnapshot;

      onEvent({
        type: "provider:scrape",
        provider: provider.name,
        data: {
          entries: changelogData.entries.length,
          durationMs: scrapeResult.changelog.durationMs,
        },
        timestamp: new Date().toISOString(),
      });

      // Step 2: Diff
      checkCancelled(signal);
      const diffResult = await diffChangelog(provider.id, changelogData);
      await storeSnapshot(provider.id, scan.id, changelogData);

      onEvent({
        type: "provider:diff",
        provider: provider.name,
        data: {
          isFirstScan: diffResult.isFirstScan,
          newEntries: diffResult.newEntries.length,
          totalCurrent: diffResult.totalCurrent,
        },
        timestamp: new Date().toISOString(),
      });

      // Step 3: Classify
      checkCancelled(signal);
      const classified = await classifyChanges(provider.name, diffResult.newEntries);

      // Step 3b: Transform deprecation entries
      let deprecationChanges: ClassifiedChange[] = [];
      if (
        scrapeResult.deprecation.success &&
        scrapeResult.deprecation.data?.deprecations?.length
      ) {
        deprecationChanges = scrapeResult.deprecation.data.deprecations
          .slice(0, 3)
          .map((d: DeprecationEntry) => ({
            title: `${d.feature_or_endpoint} will be removed`,
            date: d.removal_date || "unknown",
            source: "deprecation" as const,
            change_type: "deprecation" as const,
            urgency: 9,
            impact: `Scheduled for removal on ${d.removal_date || "unknown date"}`,
            action_required: d.migration_guidance || "Review and migrate",
            suggested_fix: d.migration_guidance || "Check provider docs for migration path",
            code_example: "// Check deprecation notice for updated endpoint/model",
            timeline: "soon" as const,
          }));

        onEvent({
          type: "provider:deprecation",
          provider: provider.name,
          data: { deprecations: deprecationChanges.length },
          timestamp: new Date().toISOString(),
        });
      }

      // Merge and sort by urgency
      const allProviderChanges = [...classified, ...deprecationChanges]
        .sort((a, b) => b.urgency - a.urgency);

      // Persist to database
      checkCancelled(signal);
      await saveClassifiedChanges(scan.id, provider.id, provider.name, allProviderChanges);

      allClassified.push(...allProviderChanges);

      onEvent({
        type: "provider:classify",
        provider: provider.name,
        data: { classified: allProviderChanges.length },
        timestamp: new Date().toISOString(),
      });

      const providerMs = Date.now() - providerStart;

      results.push({
        provider: provider.name,
        success: true,
        durationMs: providerMs,
        entriesScraped: changelogData.entries.length,
        newEntries: diffResult.newEntries.length,
        classified: allProviderChanges,
      });

      onEvent({
        type: "provider:complete",
        provider: provider.name,
        data: { durationMs: providerMs, success: true },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      if (err instanceof ScanCancelledError || signal?.aborted) {
        console.log(`[scan-engine] 🛑 Cancelled during ${provider.name}`);
        wasCancelled = true;
        break;
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      const providerMs = Date.now() - providerStart;

      results.push({
        provider: provider.name,
        success: false,
        durationMs: providerMs,
        entriesScraped: 0,
        newEntries: 0,
        classified: [],
        error: errorMsg,
      });

      onEvent({
        type: "provider:error",
        provider: provider.name,
        data: { error: errorMsg, durationMs: providerMs },
        timestamp: new Date().toISOString(),
      });
    }
  }

  // Handle cancellation
  if (wasCancelled) {
    await supabase
      .from("scans")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", scan.id);

    onEvent({
      type: "scan:cancelled",
      data: {
        scanId: scan.id,
        totalDurationMs: Date.now() - overallStart,
        providersCompleted: results.length,
        providersRemaining: providers.length - results.length,
      },
      timestamp: new Date().toISOString(),
    });

    return {
      scanId: scan.id,
      totalDurationMs: Date.now() - overallStart,
      providers: results,
      emailSent: false,
      cancelled: true,
    };
  }

  // Step 4: Email alerts for critical changes
  console.log(`[scan-engine] 📧 Email step — ${allClassified.length} total classified changes`);
  const criticalForEmail = allClassified.filter((c) => c.urgency >= 7 || c.change_type === "breaking");
  console.log(`[scan-engine] 📧 Critical changes for email: ${criticalForEmail.length}`);

  const emailResult = await sendAlertEmail(
    providers.map((p) => p.name).join(", "),
    allClassified
  );

  console.log(`[scan-engine] 📧 Email result: sent=${emailResult.sent}, count=${emailResult.count}${emailResult.error ? `, error=${emailResult.error}` : ""}`);

  // Update scan status
  await supabase
    .from("scans")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", scan.id);

  const totalMs = Date.now() - overallStart;

  onEvent({
    type: "scan:complete",
    data: {
      scanId: scan.id,
      totalDurationMs: totalMs,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      totalClassified: allClassified.length,
      emailSent: emailResult.sent,
    },
    timestamp: new Date().toISOString(),
  });

  return {
    scanId: scan.id,
    totalDurationMs: totalMs,
    providers: results,
    emailSent: emailResult.sent,
  };
}
