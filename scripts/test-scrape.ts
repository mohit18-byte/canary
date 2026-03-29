/**
 * Test OpenAI deprecation detection
 */
import { config } from "dotenv";
config({ path: ".env.local" });

const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" 🐤 Canary — OpenAI Deprecation Detection Test");
  console.log("═══════════════════════════════════════════════════════\n");

  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerSlugs: ["openai"] }),
    });
  } catch (err) {
    console.error("❌ Fetch failed:", err);
    process.exit(1);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`❌ HTTP ${res.status}: ${text}`);
    process.exit(1);
  }

  console.log(`✅ Connected (HTTP ${res.status}) — streaming events...\n`);

  const reader = res.body?.getReader();
  if (!reader) { console.error("No reader"); process.exit(1); }

  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: Record<string, unknown> | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        let eventType = "message", eventData = "";
        for (const line of trimmed.split("\n")) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          if (line.startsWith("data:")) eventData = line.slice(5).trim();
        }
        if (!eventData) continue;
        try {
          const p = JSON.parse(eventData);
          const prov = p.provider ? `[${p.provider}]` : "";
          switch (eventType) {
            case "scan:start": console.log(`  🚀 Scan started — ${p.data?.providerCount} provider(s)`); break;
            case "provider:start": console.log(`  ⏳ ${prov} Scanning...`); break;
            case "provider:scrape": console.log(`  📋 ${prov} ${p.data?.entries} changelog entries (${(p.data?.durationMs/1000).toFixed(1)}s)`); break;
            case "provider:deprecation": console.log(`  ⚠️  ${prov} ${p.data?.deprecations} deprecation(s) found`); break;
            case "provider:diff": console.log(`  🔀 ${prov} ${p.data?.newEntries} new entries`); break;
            case "provider:classify": console.log(`  🧠 ${prov} ${p.data?.classified} total classified`); break;
            case "provider:complete": console.log(`  ✅ ${prov} Done (${(p.data?.durationMs/1000).toFixed(1)}s)`); break;
            case "provider:error": console.log(`  ❌ ${prov} ${p.data?.error}`); break;
            case "scan:complete": console.log(`  🏁 Complete (${(p.data?.totalDurationMs/1000).toFixed(1)}s)`); break;
            case "done": finalResult = p; break;
            case "error": console.log(`  ❌ Error: ${p.error}`); break;
          }
        } catch {}
      }
    }
  } catch (err) {
    console.error("Stream error:", err);
  }

  console.log(`\n  Total: ${((Date.now()-start)/1000).toFixed(1)}s`);

  if (finalResult && "providers" in finalResult) {
    const providers = finalResult.providers as Array<{
      provider: string;
      classified: Array<{ title: string; change_type: string; urgency: number; source: string }>;
    }>;
    for (const p of providers) {
      console.log(`\n  ── ${p.provider} Changes (${p.classified.length}) ──`);
      for (const c of p.classified) {
        const icon = c.change_type === "deprecation" ? "⚠️" : c.change_type === "breaking" ? "🔴" : "🟢";
        console.log(`    ${icon} [${c.change_type}] urgency:${c.urgency} | ${c.title} (${c.source})`);
      }
    }
  }

  console.log("\n═══════════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
