/**
 * TinyFish API Client
 *
 * Uses POST https://agent.tinyfish.ai/v1/automation/run-sse (SSE endpoint)
 * Reads the SSE event stream incrementally and extracts the final result.
 *
 * Supports:
 *  - External AbortSignal for cancellation
 *  - run_id extraction for TinyFish cancel API
 *  - Active run tracking for global cancellation
 */

const TINYFISH_SSE_URL = "https://agent.tinyfish.ai/v1/automation/run-sse";
const TINYFISH_CANCEL_URL = "https://agent.tinyfish.ai/v1/runs";
const TIMEOUT_MS = 240_000; // 4 minutes — leaves 60s buffer for post-scrape work

// ─── Active Run Tracking ────────────────────────────────

/** Set of currently in-flight TinyFish run IDs */
const activeRunIds = new Set<string>();

export function getActiveRunIds(): string[] {
  return [...activeRunIds];
}

/**
 * Cancel a TinyFish run by its run_id.
 * POST https://agent.tinyfish.ai/v1/runs/{id}/cancel
 */
export async function cancelTinyFishRun(runId: string): Promise<boolean> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) return false;

  try {
    console.log(`[tinyfish] 🛑 Cancelling run ${runId}...`);
    const res = await fetch(`${TINYFISH_CANCEL_URL}/${runId}/cancel`, {
      method: "POST",
      headers: { "X-API-Key": apiKey },
    });
    const ok = res.ok;
    if (ok) {
      console.log(`[tinyfish] ✅ Run ${runId} cancelled`);
      activeRunIds.delete(runId);
    } else {
      console.warn(`[tinyfish] ⚠️ Cancel returned ${res.status} for run ${runId}`);
    }
    return ok;
  } catch (err) {
    console.error(`[tinyfish] ❌ Failed to cancel run ${runId}:`, err);
    return false;
  }
}

/**
 * Cancel ALL currently active TinyFish runs.
 */
export async function cancelAllActiveRuns(): Promise<number> {
  const ids = getActiveRunIds();
  if (ids.length === 0) return 0;
  console.log(`[tinyfish] 🛑 Cancelling ${ids.length} active run(s)...`);
  const results = await Promise.allSettled(ids.map(cancelTinyFishRun));
  const cancelled = results.filter(
    (r) => r.status === "fulfilled" && r.value
  ).length;
  activeRunIds.clear();
  return cancelled;
}

// ─── Types ──────────────────────────────────────────────

interface TinyFishRequest {
  url: string;
  goal: string;
  browser_profile?: "lite" | "stealth";
}

interface TinyFishResponse {
  success: boolean;
  data: unknown;
  error?: string;
  runId?: string;
}

// ─── SSE Parser ─────────────────────────────────────────

function parseSSEEvents(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const blocks = text.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    let event = "";
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data += (data ? "\n" : "") + line.slice(5).trim();
      }
    }

    if (data) {
      events.push({ event, data });
    }
  }

  return events;
}

// ─── Main Runner ────────────────────────────────────────

/**
 * Run a TinyFish automation via the SSE endpoint.
 * Accepts an optional AbortSignal for external cancellation.
 */
export async function runTinyFish(
  request: TinyFishRequest,
  signal?: AbortSignal
): Promise<TinyFishResponse> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) throw new Error("Missing TINYFISH_API_KEY env variable");

  // Compose abort: external signal OR timeout
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), TIMEOUT_MS);

  // If caller already aborted, bail immediately
  if (signal?.aborted) {
    clearTimeout(timeout);
    return { success: false, data: null, error: "Cancelled before start" };
  }

  // Link external signal to our timeout controller
  const onExternalAbort = () => timeoutController.abort();
  signal?.addEventListener("abort", onExternalAbort, { once: true });

  let extractedRunId: string | undefined;

  try {
    const res = await fetch(TINYFISH_SSE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        url: request.url,
        goal: request.goal,
        browser_profile: request.browser_profile ?? "stealth",
      }),
      signal: timeoutController.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        success: false,
        data: null,
        error: `TinyFish API error ${res.status}: ${body}`,
      };
    }

    const reader = res.body?.getReader();
    if (!reader) {
      return {
        success: false,
        data: null,
        error: "No response body reader available",
      };
    }

    const decoder = new TextDecoder();
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;

      // Try to extract run_id from early events
      if (!extractedRunId) {
        const idMatch = chunk.match(/"run_id"\s*:\s*"([^"]+)"/);
        if (idMatch) {
          extractedRunId = idMatch[1];
          activeRunIds.add(extractedRunId);
          console.log(`[tinyfish] 🏷️ Captured run_id: ${extractedRunId}`);
        }
      }
    }

    // Parse all SSE events
    const events = parseSSEEvents(fullText);
    let resultData: unknown = null;

    for (const evt of events) {
      try {
        const parsed = JSON.parse(evt.data);

        // Extract run_id if not captured yet
        if (!extractedRunId && parsed.run_id) {
          extractedRunId = parsed.run_id as string;
          activeRunIds.add(extractedRunId);
        }

        if (
          evt.event === "agent_response" ||
          evt.event === "result" ||
          evt.event === "final" ||
          evt.event === "complete" ||
          evt.event === "done"
        ) {
          resultData = parsed.result ?? parsed.output ?? parsed.data ?? parsed;
        }

        if (parsed.result || parsed.output) {
          resultData = parsed.result ?? parsed.output;
        }

        if (parsed.type === "agent_response" || parsed.status === "completed") {
          resultData = parsed.result ?? parsed.output ?? parsed.data ?? parsed;
        }
      } catch {
        // Not JSON — skip
      }
    }

    // Fallback: try parsing full text
    if (resultData === null && fullText.length > 0) {
      const jsonMatch = fullText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          resultData = JSON.parse(jsonMatch[0]);
        } catch {
          resultData = fullText;
        }
      } else {
        resultData = fullText;
      }
    }

    return {
      success: resultData !== null,
      data: resultData,
      error: resultData === null ? "No result data in SSE stream" : undefined,
      runId: extractedRunId,
    };
  } catch (err: unknown) {
    // If we captured a run_id and got aborted, cancel the remote run
    if (extractedRunId && (signal?.aborted || timeoutController.signal.aborted)) {
      cancelTinyFishRun(extractedRunId).catch(() => {});
    }

    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError")
    ) {
      const reason = signal?.aborted ? "Cancelled by user" : `Timed out after ${TIMEOUT_MS / 1000}s`;
      return { success: false, data: null, error: reason, runId: extractedRunId };
    }
    return {
      success: false,
      data: null,
      error: `TinyFish request failed: ${err instanceof Error ? err.message : String(err)}`,
      runId: extractedRunId,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onExternalAbort);
    // Clean up from active set
    if (extractedRunId) activeRunIds.delete(extractedRunId);
  }
}
