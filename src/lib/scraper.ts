/**
 * Provider Scraper — optimized for demo performance
 *
 * Scrapes changelog for all providers.
 * Scrapes deprecations for OpenAI only.
 */

import { runTinyFish } from "./tinyfish";
import { changelogGoal, deprecationGoal } from "./prompts";
import type { ChangelogSnapshot } from "@/types";

export interface ScrapeSourceResult<T> {
  success: boolean;
  data: T | null;
  error?: string;
  durationMs: number;
  skipped?: boolean;
}

export interface DeprecationEntry {
  feature_or_endpoint: string;
  removal_date: string;
  migration_guidance: string;
}

export interface DeprecationSnapshot {
  deprecations: DeprecationEntry[];
}

export interface ScrapeResult {
  changelog: ScrapeSourceResult<ChangelogSnapshot>;
  deprecation: ScrapeSourceResult<DeprecationSnapshot>;
  status: ScrapeSourceResult<null>;
}

/**
 * Try to parse a JSON object from a (possibly messy) response.
 */
function extractJSON<T>(raw: unknown): T | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "object") return raw as T;

  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      // noop
    }

    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      try {
        return JSON.parse(fenceMatch[1].trim()) as T;
      } catch {
        // noop
      }
    }

    const braceMatch = raw.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]) as T;
      } catch {
        // noop
      }
    }
  }

  return null;
}

interface ProviderConfig {
  name: string;
  slug?: string;
  changelog_url: string;
  deprecation_url: string | null;
  status_url: string | null;
}

export async function scrapeProvider(
  provider: ProviderConfig,
  signal?: AbortSignal
): Promise<ScrapeResult> {
  // Run changelog scrape
  const [changelogResult] = await Promise.allSettled([
    (async () => {
      const start = Date.now();
      const res = await runTinyFish({
        url: provider.changelog_url,
        goal: changelogGoal(provider.changelog_url),
        browser_profile: "stealth",
      }, signal);
      const durationMs = Date.now() - start;

      if (!res.success) {
        return { success: false, data: null, error: res.error, durationMs };
      }

      const parsed = extractJSON<ChangelogSnapshot>(res.data);
      return {
        success: parsed !== null,
        data: parsed,
        error: parsed === null ? "Failed to parse structured data" : undefined,
        durationMs,
      };
    })(),
  ]);

  // Run deprecation scrape ONLY for OpenAI
  let deprecationResult: ScrapeSourceResult<DeprecationSnapshot> = {
    success: false,
    data: null,
    durationMs: 0,
    skipped: true,
  };

  if (provider.slug === "openai" && provider.deprecation_url) {
    try {
      const start = Date.now();
      const res = await runTinyFish({
        url: provider.deprecation_url,
        goal: deprecationGoal(provider.deprecation_url),
        browser_profile: "stealth",
      }, signal);
      const durationMs = Date.now() - start;

      if (res.success) {
        const parsed = extractJSON<DeprecationSnapshot>(res.data);
        deprecationResult = {
          success: parsed !== null && Array.isArray(parsed?.deprecations),
          data: parsed,
          error: parsed === null ? "Failed to parse deprecation data" : undefined,
          durationMs,
        };
      } else {
        deprecationResult = {
          success: false,
          data: null,
          error: res.error,
          durationMs,
        };
      }
    } catch {
      // Silently ignore — don't break the pipeline
    }
  }

  return {
    changelog:
      changelogResult.status === "fulfilled"
        ? changelogResult.value
        : { success: false, data: null, error: "Unexpected error", durationMs: 0 },
    deprecation: deprecationResult,
    status: { success: false, data: null, durationMs: 0, skipped: true },
  };
}
