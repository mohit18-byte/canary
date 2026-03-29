"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// ─── Inner Component (uses useSearchParams) ──────────────

function DocsViewerInner() {
  const params = useSearchParams();
  const sourceUrl = params.get("url") ?? "";
  const query = params.get("q") ?? "";
  const provider = params.get("provider") ?? "API";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [htmlContent, setHtmlContent] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const highlightAndScroll = useCallback(
    (html: string, searchQuery: string) => {
      if (!searchQuery) {
        setHtmlContent(html);
        setMatchCount(0);
        return;
      }

      // Create search variations (exact, partial words)
      const terms = searchQuery
        .split(/\s+/)
        .filter((t) => t.length > 2);

      let highlighted = html;
      let count = 0;

      // First try exact phrase
      const exactRegex = new RegExp(
        `(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
        "gi"
      );
      const exactMatches = html.match(exactRegex);
      if (exactMatches && exactMatches.length > 0) {
        highlighted = html.replace(
          exactRegex,
          '<mark class="docs-highlight" id="first-match">$1</mark>'
        );
        count = exactMatches.length;
      } else if (terms.length > 0) {
        // Fall back to individual word matching
        for (const term of terms) {
          const termRegex = new RegExp(
            `(${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
            "gi"
          );
          const matches = highlighted.match(termRegex);
          if (matches) {
            const isFirst = count === 0;
            highlighted = highlighted.replace(
              termRegex,
              isFirst
                ? '<mark class="docs-highlight" id="first-match">$1</mark>'
                : '<mark class="docs-highlight">$1</mark>'
            );
            count += matches.length;
          }
        }
      }

      setHtmlContent(highlighted);
      setMatchCount(count);
    },
    []
  );

  useEffect(() => {
    if (!sourceUrl) {
      setError("No source URL provided");
      setLoading(false);
      return;
    }

    const fetchDocs = async () => {
      setLoading(true);
      setError(null);

      try {
        // Use a CORS proxy approach — fetch via our API route
        const res = await fetch(
          `/api/docs-proxy?url=${encodeURIComponent(sourceUrl)}`
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch documentation (${res.status})`);
        }

        const data = await res.json();
        highlightAndScroll(data.content ?? "", query);
      } catch {
        // If fetch fails, fall back to iframe
        setError("iframe");
      } finally {
        setLoading(false);
      }
    };

    fetchDocs();
  }, [sourceUrl, query, highlightAndScroll]);

  // Scroll to first match after render
  useEffect(() => {
    if (!loading && matchCount > 0) {
      setTimeout(() => {
        const el = document.getElementById("first-match");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 300);
    }
  }, [loading, matchCount]);

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-zinc-500 hover:text-white transition-colors text-sm flex items-center gap-1.5"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Dashboard
          </Link>
          <div className="w-px h-4 bg-zinc-700" />
          <span className="text-sm text-white font-medium">
            📚 Source Documentation
          </span>
        </div>

        <div className="flex items-center gap-3">
          {query && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
              <svg
                className="w-3.5 h-3.5 text-zinc-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <span className="text-xs text-zinc-400">{query}</span>
              {matchCount > 0 && (
                <span className="text-[10px] text-indigo-400 font-mono">
                  {matchCount} match{matchCount !== 1 ? "es" : ""}
                </span>
              )}
            </div>
          )}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-zinc-500 hover:text-indigo-400 transition-colors flex items-center gap-1"
            >
              Open original
              <svg
                className="w-3 h-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      </header>

      {/* Provider + URL Bar */}
      <div className="px-6 py-2 border-b border-zinc-800/50 flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-zinc-600 font-semibold">
          {provider}
        </span>
        <div className="w-px h-3 bg-zinc-800" />
        <span className="text-xs text-zinc-500 font-mono truncate">
          {sourceUrl.replace(/^https?:\/\/(www\.)?/, "")}
        </span>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-3">
              <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-zinc-400">
                Loading documentation...
              </p>
              <p className="text-xs text-zinc-600">
                Fetching from {provider}
              </p>
            </div>
          </div>
        ) : error === "iframe" ? (
          // Fallback to iframe
          <div className="flex flex-col h-full">
            {matchCount === 0 && query && (
              <div className="px-6 py-2 bg-amber-500/5 border-b border-amber-500/10">
                <p className="text-xs text-amber-400">
                  📍 Showing source page — search for &ldquo;{query}&rdquo; to
                  find the relevant section
                </p>
              </div>
            )}
            <iframe
              src={sourceUrl}
              className="flex-1 w-full border-0 bg-white"
              style={{ minHeight: "calc(100vh - 120px)" }}
              sandbox="allow-same-origin allow-scripts"
              title={`${provider} Documentation`}
            />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-2">
              <span className="text-2xl">⚠️</span>
              <p className="text-sm text-red-400">{error}</p>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:underline"
                >
                  Open source page directly →
                </a>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto px-6 py-8">
            {matchCount === 0 && query && (
              <div className="mb-4 px-4 py-2 rounded-lg bg-amber-500/5 border border-amber-500/10">
                <p className="text-xs text-amber-400">
                  📍 Showing closest relevant section — exact match for &ldquo;
                  {query}&rdquo; not found
                </p>
              </div>
            )}
            {matchCount > 0 && (
              <div className="mb-4 px-4 py-2 rounded-lg bg-green-500/5 border border-green-500/10">
                <p className="text-xs text-green-400">
                  ✅ Found {matchCount} match{matchCount !== 1 ? "es" : ""} for
                  &ldquo;{query}&rdquo; — scrolled to first result
                </p>
              </div>
            )}
            <div
              ref={contentRef}
              className="docs-content prose prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          </div>
        )}
      </main>

      {/* Highlight Styles */}
      <style jsx global>{`
        .docs-highlight {
          background-color: rgba(234, 179, 8, 0.25);
          color: #fbbf24;
          padding: 1px 4px;
          border-radius: 3px;
          border-bottom: 2px solid rgba(234, 179, 8, 0.5);
        }
        .docs-content h1,
        .docs-content h2,
        .docs-content h3 {
          color: #fff;
          margin-top: 1.5em;
        }
        .docs-content p {
          color: #a1a1aa;
        }
        .docs-content a {
          color: #818cf8;
        }
        .docs-content code {
          background: #18181b;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.85em;
          color: #4ade80;
        }
        .docs-content pre {
          background: #18181b;
          padding: 1em;
          border-radius: 8px;
          overflow-x: auto;
        }
      `}</style>
    </div>
  );
}

// ─── Page Export (Suspense boundary for useSearchParams) ──

export default function DocsViewerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-black">
          <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DocsViewerInner />
    </Suspense>
  );
}
