/**
 * POST /api/cancel-scan — Cancel the active scan
 *
 * 1. Aborts the scan-engine AbortController (stops pipeline)
 * 2. Cancels any in-flight TinyFish runs via their cancel API
 * 3. Returns cancellation status
 */

import { getActiveScanController, clearActiveScan } from "@/app/api/scan/route";
import { cancelAllActiveRuns } from "@/lib/tinyfish";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const controller = getActiveScanController();

  if (!controller) {
    return Response.json(
      { cancelled: false, message: "No active scan to cancel" },
      { status: 200 }
    );
  }

  console.log("[cancel-scan] 🛑 Cancel requested");

  // 1. Abort the scan pipeline
  controller.abort();
  clearActiveScan();

  // 2. Cancel any in-flight TinyFish runs
  const tinyfishCancelled = await cancelAllActiveRuns();
  console.log(`[cancel-scan] ✅ Cancelled ${tinyfishCancelled} TinyFish run(s)`);

  return Response.json({
    cancelled: true,
    tinyfishRunsCancelled: tinyfishCancelled,
    message: "Scan cancelled successfully",
  });
}
