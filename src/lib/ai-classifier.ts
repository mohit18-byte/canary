/**
 * AI Classifier — OpenAI gpt-4o powered
 *
 * Transforms raw changelog entries into actionable developer guidance.
 * Falls back to rule-based scoring if the API is unavailable.
 */

import OpenAI from "openai";
import type { ChangelogEntry } from "@/types";

// ─── Types ───────────────────────────────────────────────

export interface ClassifiedChange {
  title: string;
  date: string;
  source: string;
  change_type: "breaking" | "deprecation" | "feature" | "incident" | "resolved";
  urgency: number;
  impact: string;
  action_required: string;
  suggested_fix: string;
  code_example: string;
  timeline: "immediate" | "soon" | "later";
}

// ─── OpenAI Client (lazy) ────────────────────────────────

let _client: OpenAI | null = null;

function getClient(): OpenAI | null {
  if (_client) return _client;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("[ai-classifier] ❌ OPENAI_API_KEY is NOT set");
    return null;
  }
  console.log(`[ai-classifier] ✅ OPENAI_API_KEY loaded`);
  _client = new OpenAI({ apiKey });
  return _client;
}

// ─── System Prompt ───────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior API infrastructure engineer generating incident-response-quality classifications.

Your audience is a production engineering team. They need to know EXACTLY what changed, what will break, and how to fix it — immediately.

You will receive MULTIPLE changelog entries.
Each entry includes: title, date, summary.

You MUST return a JSON array with EXACTLY the same number of objects as input entries.

----------------------------------------
OUTPUT FORMAT (STRICT)
----------------------------------------

Each object MUST contain:

{
  "change_type": "breaking" | "deprecation" | "feature",
  "urgency": number (1-10),
  "impact": string,
  "action_required": string,
  "suggested_fix": string,
  "code_example": string,
  "timeline": "immediate" | "soon" | "later"
}

----------------------------------------
CLASSIFICATION RULES
----------------------------------------

change_type:
- breaking → existing integrations WILL fail or behavior changes
- deprecation → still works but has a removal path
- feature → additive or improvement

urgency:
- breaking → 8–10
- deprecation → 5–8
- feature → 1–4

timeline:
- breaking → "immediate"
- deprecation → "soon"
- feature → "later"

----------------------------------------
FIELD REQUIREMENTS
----------------------------------------

impact:
- EXACTLY one sentence
- MUST describe what FAILS, BREAKS, or STOPS WORKING
- Include real system behavior (errors, rejected requests, incorrect results)

action_required:
- EXACTLY one direct instruction
- MUST include specific API / model / endpoint / SDK reference
- MUST be immediately actionable

suggested_fix:
- 1–2 sentences
- MUST include a concrete migration path or replacement
- If not explicitly given, infer a realistic modern alternative

code_example:
- MUST include BEFORE → AFTER OR real usage example
- Keep minimal and relevant
- NEVER omit code

----------------------------------------
STRICT RULES
----------------------------------------

- Return ONLY a JSON array (no markdown, no explanations)
- Array length MUST match input length exactly
- NEVER use vague phrases:
  "Not specified", "Unknown", "Check documentation", "N/A"
- DO NOT hallucinate exact versions, dates, or endpoints
- If uncertain, still provide best-effort guidance but keep it realistic
- Every field MUST contain actionable content

----------------------------------------
TONE
----------------------------------------

Write like you are on-call during a production incident at 2 AM.
Be precise, decisive, and operational.
No fluff. No hedging.
`;

// ─── LLM Classification ─────────────────────────────────

async function classifyWithLLM(
  providerName: string,
  entries: ChangelogEntry[]
): Promise<ClassifiedChange[] | null> {
  const client = getClient();
  if (!client) {
    console.error("[ai-classifier] ❌ OpenAI client is null — skipping LLM");
    return null;
  }

  console.log(`[ai-classifier] 🚀 Calling gpt-4o for ${entries.length} entries (${providerName})`);

  const userPrompt = `Provider: ${providerName}

Classify these ${entries.length} API changelog entries. For each, determine change_type, urgency, impact, action_required, suggested_fix, and code_example.

${entries
      .map(
        (e, i) =>
          `${i + 1}. Title: "${e.title ?? "Untitled"}"
   Date: ${e.date ?? "Unknown"}
   Summary: "${e.summary ?? "No summary"}"`
      )
      .join("\n\n")}

Return a JSON array with exactly ${entries.length} objects.
Remember: NO generic phrases. Every field must be specific and actionable.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.1,
      max_tokens: 2500,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    });

    console.log(`[ai-classifier] 📡 Response received`);

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      console.error("[ai-classifier] ❌ Empty response from OpenAI");
      return null;
    }

    console.log(`[ai-classifier] ✅ ${content.length} chars`);

    // Extract JSON (handle markdown fences)
    let jsonStr = content;
    const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();

    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed) || parsed.length !== entries.length) {
      console.error(`[ai-classifier] ❌ Array mismatch: got ${Array.isArray(parsed) ? parsed.length : "non-array"}, expected ${entries.length}`);
      return null;
    }

    console.log(`[ai-classifier] ✅ Parsed ${parsed.length} classifications`);

    return entries.map((entry, i) => {
      const ai = parsed[i] ?? {};
      const changeType = validateChangeType(ai.change_type);
      return {
        title: entry.title ?? "Untitled",
        date: entry.date ?? "Unknown",
        source: "changelog",
        change_type: changeType,
        urgency: clampUrgency(ai.urgency),
        impact: sanitize(ai.impact, strongImpact(changeType, entry.title ?? "")),
        action_required: sanitize(ai.action_required, strongAction(changeType, entry.title ?? "")),
        suggested_fix: sanitize(ai.suggested_fix, strongFix(changeType, entry.title ?? "")),
        code_example: sanitize(ai.code_example, strongCode(changeType, entry.title ?? "")),
        timeline: validateTimeline(ai.timeline, changeType),
      };
    });
  } catch (err) {
    console.error("[ai-classifier] ❌ OpenAI API FAILED:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// ─── Validation & Sanitization ───────────────────────────

const BANNED_PHRASES = [
  "not specified", "no replacement", "check documentation",
  "check the documentation", "unknown", "n/a", "no code change needed",
  "review your implementation", "see documentation", "refer to docs",
];

function sanitize(val: unknown, fallback: string): string {
  if (typeof val !== "string" || val.trim().length === 0) return fallback;
  const lower = val.toLowerCase().trim();
  if (BANNED_PHRASES.some((bp) => lower.includes(bp))) return fallback;
  return val;
}

function validateChangeType(raw: unknown): "breaking" | "deprecation" | "feature" {
  if (raw === "breaking" || raw === "deprecation" || raw === "feature") return raw;
  return "feature";
}

function validateTimeline(raw: unknown, changeType: string): "immediate" | "soon" | "later" {
  if (raw === "immediate" || raw === "soon" || raw === "later") return raw;
  if (changeType === "breaking") return "immediate";
  if (changeType === "deprecation") return "soon";
  return "later";
}

function clampUrgency(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  if (isNaN(n)) return 3;
  return Math.min(10, Math.max(1, Math.round(n)));
}

// ─── Strong Fallback Generators ──────────────────────────

function extractKeyTerm(title: string): string {
  // Pull the most meaningful part from the title for fallback use
  const cleaned = title.replace(/^(new|updated|added|removed|deprecated)[:.\s]*/i, "").trim();
  return cleaned || title;
}

function strongImpact(type: string, title: string): string {
  const term = extractKeyTerm(title);
  return {
    breaking: `Existing integrations using ${term} will stop working and return errors in production.`,
    deprecation: `${term} is scheduled for removal — continued use risks production failures after the sunset date.`,
    feature: `${term} is now available and can improve application performance or capabilities.`,
  }[type] ?? `${term} has been updated. Review for potential impact on your integration.`;
}

function strongAction(type: string, title: string): string {
  const term = extractKeyTerm(title);
  return {
    breaking: `Update your implementation to replace ${term} with the latest supported alternative immediately.`,
    deprecation: `Migrate away from ${term} to a currently supported alternative before the removal deadline.`,
    feature: `Consider adopting ${term} to improve your integration's performance or capabilities.`,
  }[type] ?? `Review ${term} and evaluate impact on your integration.`;
}

function strongFix(type: string, title: string): string {
  const term = extractKeyTerm(title);
  return {
    breaking: `Replace all references to ${term} with the latest supported version. Update SDK and test thoroughly before deploying.`,
    deprecation: `Plan migration from ${term} to the recommended replacement. Check the provider's migration guide for exact steps.`,
    feature: `Integrate ${term} using the provider's latest SDK. Refer to the API reference for parameters and options.`,
  }[type] ?? `Review the changelog entry for ${term} and update your integration accordingly.`;
}

function strongCode(type: string, title: string): string {
  const term = extractKeyTerm(title);
  return {
    breaking: `// Before\n// ${term} (removed/changed)\n// After\n// Use the latest supported replacement`,
    deprecation: `// Deprecated\n// ${term}\n// Migrate to the recommended alternative`,
    feature: `// New\n// ${term}\n// See provider docs for integration example`,
  }[type] ?? `// ${term}\n// See provider docs for usage`;
}

// ─── Rule-Based Fallback ─────────────────────────────────

const BREAKING_KW = ["breaking", "removed", "no longer supported", "discontinued", "deleted", "incompatible", "migration required"];
const DEPRECATION_KW = ["deprecated", "sunset", "will be removed", "phasing out", "legacy", "end of support", "replaced by", "retiring"];
const FEATURE_KW = ["added", "introduced", "released", "new", "support", "launched", "available", "improved", "enhanced", "updated"];

function scoreText(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0);
}

function classifyEntryFallback(entry: ChangelogEntry): ClassifiedChange {
  const combined = `${entry.title ?? ""} ${entry.summary ?? ""}`;
  const bScore = scoreText(combined, BREAKING_KW) * 3;
  const dScore = scoreText(combined, DEPRECATION_KW) * 3;
  const fScore = scoreText(combined, FEATURE_KW) * 2;

  let change_type: "breaking" | "deprecation" | "feature";
  let urgency: number;

  if (bScore > 0 && bScore >= dScore && bScore >= fScore) {
    change_type = "breaking"; urgency = Math.min(10, 8 + Math.floor(bScore / 3));
  } else if (dScore > 0 && dScore >= fScore) {
    change_type = "deprecation"; urgency = Math.min(10, 6 + Math.floor(dScore / 3));
  } else {
    change_type = "feature"; urgency = Math.min(4, 2 + Math.floor(fScore / 3));
  }

  const title = entry.title ?? "Untitled";

  return {
    title,
    date: entry.date ?? "Unknown",
    source: "changelog",
    change_type,
    urgency,
    impact: strongImpact(change_type, title),
    action_required: strongAction(change_type, title),
    suggested_fix: strongFix(change_type, title),
    code_example: strongCode(change_type, title),
    timeline: validateTimeline(null, change_type),
  };
}

// ─── Public API ──────────────────────────────────────────

export async function classifyChanges(
  providerName: string,
  entries: ChangelogEntry[]
): Promise<ClassifiedChange[]> {
  if (entries.length === 0) return [];

  console.log(`\n[ai-classifier] ═══ Classification: ${providerName} (${entries.length} entries) ═══`);

  const llmResult = await classifyWithLLM(providerName, entries);
  if (llmResult) {
    console.log(`[ai-classifier] ✅ gpt-4o classification succeeded`);
    return llmResult;
  }

  console.warn("[ai-classifier] ⚠️ FALLING BACK to rule-based classifier");
  return entries.map(classifyEntryFallback);
}
