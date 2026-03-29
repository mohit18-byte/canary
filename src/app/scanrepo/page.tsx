"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

function LogLine({ text, delay }: { text: string; delay: number }) {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setShow(true), delay);
        return () => clearTimeout(t);
    }, [delay]);

    if (!show) return null;

    const color = text.includes("✓")
        ? "text-green-400"
        : text.includes("⚠")
            ? "text-amber-400"
            : text.includes("✗")
                ? "text-red-400"
                : text.startsWith("$")
                    ? "text-indigo-400"
                    : text.startsWith("  [")
                        ? "text-zinc-600"
                        : "text-zinc-400";

    return (
        <div className={`font-mono text-xs leading-relaxed ${color}`}>{text}</div>
    );
}

export default function ScanRepoPage() {
    const [repo, setRepo] = useState("");
    const [focused, setFocused] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanDone, setScanDone] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [logKey, setLogKey] = useState(0);

    const repoName = repo || "your-org/your-repo";

    const logs = [
        { text: `$ canary scan --repo ${repoName}`, delay: 100 },
        { text: "→ Authenticating with TinyFish agent...", delay: 500 },
        { text: "  ✓ Agent connected (region: us-east-1)", delay: 900 },
        { text: `→ Cloning ${repoName}...`, delay: 1200 },
        { text: "  ✓ 247 files indexed across 14 directories", delay: 1700 },
        { text: "→ Resolving dependency tree...", delay: 2000 },
        { text: "  [package.json]  openai@4.12.0", delay: 2300 },
        { text: "  [package.json]  stripe@14.5.0", delay: 2500 },
        { text: "  [package.json]  @anthropic-ai/sdk@0.20.1", delay: 2700 },
        { text: "  ✓ 3 API providers detected", delay: 3000 },
        { text: "→ Scraping OpenAI changelog...", delay: 3300 },
        { text: "  ✓ 6 entries extracted", delay: 3700 },
        { text: "  ⚠ BREAKING: chatgpt-4o-latest sunset June 2026 — urgency 9/10", delay: 4000 },
        { text: "  ✓ 2 safe model aliases confirmed", delay: 4300 },
        { text: "→ Scraping Stripe changelog...", delay: 4600 },
        { text: "  ✓ 4 entries extracted", delay: 5000 },
        { text: "  ⚠ DEPRECATION: /v1/charges endpoint — urgency 6/10", delay: 5300 },
        { text: "→ Scraping Anthropic changelog...", delay: 5600 },
        { text: "  ✓ 3 entries extracted", delay: 5900 },
        { text: "  ✓ claude-sonnet-4-6 extended thinking — additive, no action needed", delay: 6200 },
        { text: "→ Running AI impact analysis across 247 files...", delay: 6500 },
        { text: "✓ Scan complete — 3 changes detected in 34s", delay: 6900 },
    ];

    return (
        <div className="flex flex-col min-h-screen bg-black">

            {/* NAV */}
            <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-xl font-bold tracking-wide text-white">🐤 Canary</span>
                </Link>
                <div className="flex items-center gap-3 text-sm">
                    <span className="text-white font-medium">Scan Repo</span>
                    <Link href="/dashboard" className="text-zinc-400 hover:text-white transition-colors duration-200">
                        Dashboard
                    </Link>
                </div>
            </nav>

            {/* HERO */}
            <section className="flex flex-col items-center justify-center text-center px-6 pt-24 pb-16">
                <button
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-indigo-400 border border-indigo-500/30 rounded-full bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors duration-200"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                    Early access launching soon.
                </button>


                <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white max-w-3xl">
                    Your code will break.
                    <br />
                    <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-400 via-purple-400 to-pink-400">
                        We'll tell you where.
                    </span>
                </h1>

                <p className="mt-4 text-sm text-zinc-400 max-w-xl leading-relaxed">
                    Stop reading changelogs. Canary detects breaking API changes, explains impact, and tells you exactly what to fix — before it hits production.
                </p>

                {/* INPUT */}
                <div className={`mt-8 flex items-center gap-2 w-full max-w-md border rounded-lg px-3 py-1.5 transition-all duration-200 ${focused ? "border-indigo-500/50 bg-zinc-950" : "border-zinc-800 bg-zinc-950"}`}>
                    <span className="font-mono text-xs text-zinc-500 shrink-0">github.com/</span>
                    <input
                        value={repo}
                        onChange={e => setRepo(e.target.value)}
                        onFocus={() => setFocused(true)}
                        onBlur={() => setFocused(false)}
                        onKeyDown={e => e.key === "Enter" && setModalOpen(true)}
                        placeholder="your-org/your-repo"
                        className="flex-1 min-w-0 bg-transparent outline-none font-mono text-xs text-white placeholder:text-zinc-600"
                    />
                    <button
                        onClick={() => setModalOpen(true)}
                        className="px-4 py-2 text-sm font-medium bg-white text-black rounded-lg hover:scale-105 transition-all duration-200 shrink-0 flex items-center gap-2"
                    >
                        Start Live Scan →
                    </button>
                </div>

                <p className="mt-3 text-xs text-zinc-500">
                    Used by teams building with Stripe, OpenAI, GitHub, and more.
                </p>
            </section>

            {/* TERMINAL */}
            <section className="flex justify-center px-6 pb-20">
                <div className="w-full max-w-2xl border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                        <span className="w-3 h-3 rounded-full bg-red-500/80" />
                        <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                        <span className="w-3 h-3 rounded-full bg-green-500/80" />
                        <span className="ml-2 text-xs text-zinc-500">terminal</span>
                    </div>

                    <div className="p-4 space-y-0.5 min-h-36">
                        {logs.slice(0, 10).map((l, i) => (
                            <LogLine key={i} text={l.text} delay={l.delay} />
                        ))}
                    </div>
                </div>
            </section>

            {/* MODAL */}
            {modalOpen && (
                <div
                    onClick={() => setModalOpen(false)}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        className="bg-zinc-950 border border-zinc-800 rounded-xl p-8 max-w-sm w-full mx-4 text-center"
                    >
                        <div className="text-2xl mb-4">🚧</div>
                        <h2 className="text-sm font-semibold text-white mb-2">Coming Soon</h2>
                        <p className="text-xs text-zinc-500 mb-6">
                            Live GitHub scanning will be available soon.
                        </p>
                        <button
                            onClick={() => setModalOpen(false)}
                            className="w-full px-4 py-2 text-sm font-medium text-zinc-400 border border-zinc-800 rounded-lg hover:border-zinc-600 hover:text-white transition-all duration-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
            <div className="fixed bottom-5 left-5 z-40 bg-zinc-950 border border-zinc-800 rounded-xl p-4 w-56">
                {/* <p className="text-xs font-bold tracking-widest text-zinc-600 mb-2">COMING SOON</p> */}
                <ul className="space-y-1 mb-3">
                    {["Auto-Scan every 6 hours", "Email alerts on breaking changes", "Webhook notifications"].map((t, i) => (
                        <li key={i} className="text-xs text-zinc-600 flex items-start gap-1.5">
                            <span className="text-zinc-700 mt-px">•</span>{t}
                        </li>
                    ))}
                </ul>
                <button
                    onClick={() => setModalOpen(true)}
                    className="inline-flex items-center gap-2 px-3 py-1 mb-6 text-xs font-medium text-indigo-400 border border-indigo-500/30 rounded-full bg-indigo-500/10 hover:bg-indigo-500/15 transition-colors duration-200"
                >
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                    Powered by TinyFish🐟
                </button>
            </div>
        </div>
    );
}