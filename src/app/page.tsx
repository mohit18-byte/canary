import Link from "next/link";

const TERMINAL_LINES = [
  { text: "$ canary scan --providers stripe,openai", delay: 0 },
  { text: "→ Connecting to TinyFish agent...", delay: 1 },
  { text: "→ Scraping Stripe changelog...", delay: 2 },
  { text: "  ✓ 3 entries extracted", delay: 3 },
  { text: "  ✓ 2 active deprecations found", delay: 5 },
  { text: "→ Analyzing changes with AI...", delay: 6 },
  { text: '  ⚠ BREAKING: /v1/charges sunset June 2026 — urgency 9/10', delay: 7 },
  { text: "→ Scraping OpenAI changelog...", delay: 8 },
  { text: "  ✓ 3 entries extracted", delay: 9 },
  { text: "✓ Scan complete — 8 changes detected in 34s", delay: 10 },
];

const FEATURES = [
  {
    icon: "🔍",
    title: "Real-time Changelog Monitoring",
    description:
      "Continuously scans API changelogs and detects new updates instantly.",
  },
  {
    icon: "🧠",
    title: "Breaking Change Detection",
    description:
      "Identifies breaking changes, deprecations, and what they mean for your system.",
  },
  {
    icon: "⚡",
    title: "Proactive Alerts & Fixes",
    description:
      "Sends real-time alerts with exact fixes — before production failures happen.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* ─── Navbar ─────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-xl font-logo font-bold tracking-wide text-white">
            🐤 Canary
          </span>
        </div>
        <Link
          href="/dashboard"
          className="px-4 py-2 text-sm font-medium bg-white text-black rounded-lg hover:scale-105 transition-all duration-200"
        >
          Open Dashboard
        </Link>
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-indigo-400 border border-indigo-500/30 rounded-full bg-indigo-500/10">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
          </span>
          Powered by TinyFish
        </div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white max-w-3xl">
          Your API will break
          <br />
          <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400">
            Canary tells you before it does
          </span>
        </h1>
        <p className="mt-4 text-sm text-zinc-400 max-w-xl leading-relaxed">
          Stop reading changelogs. Canary detects breaking changes, explains impact, and tells you exactly what to fix — before it hits production.
        </p>
        <div className="flex gap-3 mt-8">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 text-sm font-medium bg-white text-black rounded-lg hover:scale-105 transition-all duration-200"
          >
            Run Live API Scan →
          </Link>
          <a
            href="https://github.com/mohit18-byte/canary"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2.5 text-sm font-medium text-zinc-400 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:text-white transition-all duration-200"
          >
            View on GitHub
          </a>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Used by teams building with Stripe, OpenAI, GitHub, and more.
        </p>

      </section>

      {/* ─── Terminal Demo ──────────────────────────────── */}
      <section className="flex justify-center px-6 pb-20">
        <div className="w-full max-w-2xl border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-xs text-zinc-500">terminal</span>
          </div>
          <div className="p-4 space-y-1">
            {TERMINAL_LINES.map((line, i) => (
              <div
                key={i}
                className="font-mono text-xs animate-fade-in"
                style={{
                  animationDelay: `${line.delay * 300}ms`,
                  animationFillMode: "both",
                }}
              >
                <span
                  className={
                    line.text.includes("✓")
                      ? "text-green-400"
                      : line.text.includes("⚠")
                        ? "text-amber-400"
                        : line.text.startsWith("$")
                          ? "text-indigo-400"
                          : "text-zinc-400"
                  }
                >
                  {line.text}
                </span>
              </div>
            ))}
          </div>
        </div>

      </section>




      {/* ─── Features ───────────────────────────────────── */}
      <section className="px-6 pb-24">

        <div className="max-w-5xl mx-auto">
          <h2 className="text-lg font-medium text-white text-center mb-10">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map((feature, i) => (
              <div
                key={i}
                className="p-6 border border-zinc-800 rounded-xl bg-zinc-950 hover:-translate-y-1 transition-all duration-200"
              >
                <div className="text-2xl mb-3">{feature.icon}</div>
                <h3 className="text-sm font-medium text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="mt-auto border-t border-zinc-800 px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            Built with{" "}
            <a
              href="https://tinyfish.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition"
            >
              TinyFish
            </a>{" "}
            · TinyFish Hackathon 2026
          </span>
          <span className="text-xs text-zinc-600">🐤 Canary v1.0</span>
        </div>
      </footer>
    </div>
  );
}
