/**
 * POST /api/scan — Trigger a scan and stream SSE progress
 *
 * Accepts: { providerSlugs: string[] }
 * All providers (built-in + custom) live in the database.
 *
 * Returns: SSE event stream with real-time progress.
 * Supports cancellation via the /api/cancel-scan endpoint.
 */

import { supabase } from "@/lib/supabase";
import { runScanPipeline } from "@/lib/scan-engine";
import type { ScanEvent } from "@/lib/scan-engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

// ─── Global active scan state ───────────────────────────
// Only one scan can run at a time. Stored here so /api/cancel-scan can abort it.

let activeScanController: AbortController | null = null;

export function getActiveScanController(): AbortController | null {
  return activeScanController;
}

export function clearActiveScan(): void {
  activeScanController = null;
}

// ─────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Prevent concurrent scans
  if (activeScanController) {
    return Response.json(
      { error: "A scan is already in progress. Stop it first." },
      { status: 409 }
    );
  }

  let providerSlugs: string[];

  try {
    const body = await request.json();
    providerSlugs = body.providerSlugs ?? body.providers ?? [];
    if (!Array.isArray(providerSlugs) || providerSlugs.length === 0) {
      return Response.json(
        { error: "providerSlugs must be a non-empty array" },
        { status: 400 }
      );
    }
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Look up providers from database
  const { data: providers, error } = await supabase
    .from("providers")
    .select("id, name, slug, changelog_url, deprecation_url")
    .in("slug", providerSlugs);

  if (error || !providers || providers.length === 0) {
    return Response.json(
      { error: `No providers found for slugs: ${providerSlugs.join(", ")}` },
      { status: 404 }
    );
  }

  // Create the AbortController for this scan
  const controller = new AbortController();
  activeScanController = controller;

  // Also abort if the client disconnects
  request.signal.addEventListener("abort", () => {
    console.log("[scan-route] Client disconnected — aborting scan");
    controller.abort();
  });

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(streamController) {
      const sendEvent = (event: ScanEvent) => {
        // Don't emit after cancellation (except the cancelled event itself)
        if (controller.signal.aborted && event.type !== "scan:cancelled") return;
        const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
        try {
          streamController.enqueue(encoder.encode(data));
        } catch {
          // Stream may be closed
        }
      };

      try {
        const result = await runScanPipeline(providers, sendEvent, controller.signal);

        if (!controller.signal.aborted) {
          const finalData = `event: done\ndata: ${JSON.stringify(result)}\n\n`;
          streamController.enqueue(encoder.encode(finalData));
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          const errorData = `event: error\ndata: ${JSON.stringify({ error: errorMsg })}\n\n`;
          streamController.enqueue(encoder.encode(errorData));
        }
      } finally {
        activeScanController = null;
        streamController.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
