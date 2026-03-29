/**
 * Diff Engine — compare current scrape against last stored snapshot
 *
 * Changelog-only (deprecation/status removed).
 * Uses content hash for fast-path and title-based diffing for granularity.
 */

import { createHash } from "crypto";
import { supabase } from "./supabase";
import type { ChangelogSnapshot, ChangelogEntry } from "@/types";

export interface DiffResult {
  isFirstScan: boolean;
  newEntries: ChangelogEntry[];
  totalCurrent: number;
  totalPrevious: number;
}

/**
 * Generate a stable hash of snapshot data for quick comparison.
 */
function hashData(data: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex");
}

/**
 * Generate a composite key for a changelog entry (title + date).
 */
function entryKey(entry: ChangelogEntry): string {
  return `${entry.title}::${entry.date}`;
}

/**
 * Compare current changelog data against the last stored snapshot.
 * Returns new entries not seen in the previous snapshot.
 */
export async function diffChangelog(
  providerId: string,
  currentData: ChangelogSnapshot
): Promise<DiffResult> {
  // Load the most recent snapshot for this provider
  const { data: prevSnapshots, error } = await supabase
    .from("snapshots")
    .select("*")
    .eq("provider_id", providerId)
    .eq("source_type", "changelog")
    .order("captured_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error loading previous snapshot:", error);
  }

  const prevSnapshot = prevSnapshots?.[0];

  // First scan — everything is new
  if (!prevSnapshot) {
    return {
      isFirstScan: true,
      newEntries: currentData.entries ?? [],
      totalCurrent: currentData.entries?.length ?? 0,
      totalPrevious: 0,
    };
  }

  // Fast path: hash comparison
  const prevHash = prevSnapshot.content_hash;
  const currentHash = hashData(currentData);

  if (prevHash === currentHash) {
    return {
      isFirstScan: false,
      newEntries: [],
      totalCurrent: currentData.entries?.length ?? 0,
      totalPrevious: (prevSnapshot.raw_data as ChangelogSnapshot)?.entries?.length ?? 0,
    };
  }

  // Detailed diff: compare entry-by-entry using composite keys
  const prevData = prevSnapshot.raw_data as ChangelogSnapshot;
  const prevKeys = new Set(
    (prevData.entries ?? []).map((e: ChangelogEntry) => entryKey(e))
  );

  const newEntries = (currentData.entries ?? []).filter(
    (e) => !prevKeys.has(entryKey(e))
  );

  return {
    isFirstScan: false,
    newEntries,
    totalCurrent: currentData.entries?.length ?? 0,
    totalPrevious: prevData.entries?.length ?? 0,
  };
}

/**
 * Store a new snapshot in Supabase.
 */
export async function storeSnapshot(
  providerId: string,
  scanId: string,
  data: ChangelogSnapshot
): Promise<void> {
  const { error } = await supabase.from("snapshots").insert({
    provider_id: providerId,
    scan_id: scanId,
    source_type: "changelog",
    raw_data: data,
    content_hash: hashData(data),
  });

  if (error) {
    console.error("Error storing snapshot:", error);
    throw error;
  }
}
