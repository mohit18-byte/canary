/**
 * GET /api/docs-proxy — Fetch and clean external documentation
 *
 * Accepts: ?url=<encoded_url>
 * Returns: { content: string } with cleaned HTML
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return Response.json(
        { error: `Failed to fetch (${res.status})` },
        { status: 502 }
      );
    }

    const html = await res.text();

    // Extract meaningful content — strip scripts, styles, nav
    const cleaned = html
      // Remove script tags and content
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      // Remove style tags and content
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      // Remove nav, header, footer elements
      .replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, "")
      // Remove SVG elements
      .replace(/<svg[\s\S]*?<\/svg>/gi, "")
      // Remove HTML comments
      .replace(/<!--[\s\S]*?-->/g, "")
      // Remove attributes except href, id, class
      .replace(
        /<(\w+)\s+(?!href|id|class)[^>]*>/gi,
        (match, tag) => `<${tag}>`
      )
      // Collapse whitespace
      .replace(/\s{2,}/g, " ")
      .trim();

    // Try to extract just the main content area
    const mainMatch =
      cleaned.match(/<main[\s\S]*?<\/main>/i) ||
      cleaned.match(/<article[\s\S]*?<\/article>/i) ||
      cleaned.match(
        /<div[^>]*(?:class|id)="[^"]*(?:content|main|changelog|docs)[^"]*"[^>]*>[\s\S]*?<\/div>/i
      );

    const content = mainMatch ? mainMatch[0] : cleaned;

    return Response.json({ content });
  } catch {
    return Response.json(
      { error: "Failed to fetch documentation" },
      { status: 502 }
    );
  }
}
