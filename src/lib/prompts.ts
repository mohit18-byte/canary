

export function changelogGoal(url: string): string {
  return `Open this URL directly:
${url}

Step 2: Extract the 3 most recent changelog updates.

Step 3: For each changelog entry, deeply analyze and extract:

- date (YYYY-MM-DD format)
- version (if available, e.g., "2026-02-25.clover")
- title (clear and concise)
- category (e.g., Payments, Billing, Tax, Terminal, Connect, etc.)
- summary (2–3 sentence concise explanation of what changed and why it matters)
- key_changes (array of 2–5 important technical or product-level changes)
- impact (short explanation of who is affected: developers, businesses, platforms, etc.)
- source (always "changelog")

Rules:
- Use ONLY visible content on the main changelog page
- Do NOT scroll excessively beyond recent entries
- Do NOT open deep links or individual update pages
- Prefer the latest versions (top-most entries)
- Keep summaries informative but concise
- Avoid hallucination — extract only what is clearly stated

Return ONLY a valid JSON object in this format:

{
  "entries": [
    {
      "date": "YYYY-MM-DD",
      "version": "...",
      "title": "...",
      "category": "...",
      "summary": "...",
      "key_changes": ["...", "..."],
      "impact": "...",
      "source": "changelog"
    }
  ]
}`;
}

export function deprecationGoal(url: string): string {
  return `Navigate to the given URL to extract API deprecations:

URL:
${url}

Step 1: Open the URL directly.

Step 2: Identify and extract the 2 most recent API deprecations (if available).

Step 3: For each deprecation, deeply analyze and extract:

- feature_or_endpoint (exact name of API, feature, or endpoint being deprecated)
- deprecation_date (when it was announced, if available)
- removal_date (when it will be removed or disabled, if available)
- replacement (recommended new API / feature, if mentioned)
- migration_guidance (2–3 sentence clear explanation of how to migrate)
- breaking_change (true/false — whether this is a breaking change)
- impact (who is affected: developers, mobile apps, backend systems, etc.)
- severity (low / medium / high based on urgency and impact)
- source (always "deprecation")

Rules:
- Use ONLY visible content on the page
- Do NOT navigate to other pages or follow links
- Do NOT scroll excessively beyond recent entries
- Ignore non-deprecation updates
- Do NOT hallucinate missing fields — use null if not available
- Prefer most recent entries (top-most content)
- Keep responses concise but informative

Return ONLY a valid JSON object in this format:

{
  "deprecations": [
    {
      "feature_or_endpoint": "...",
      "deprecation_date": "YYYY-MM-DD or null",
      "removal_date": "YYYY-MM-DD or null",
      "replacement": "... or null",
      "migration_guidance": "...",
      "breaking_change": true,
      "impact": "...",
      "severity": "low | medium | high",
      "source": "deprecation"
    }
  ]
}

If no deprecations are found, return:

{ "deprecations": [] }

Return ONLY valid JSON.`;
}