"use client";

import Link from "next/link";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  getProviderColor,
  getProviderInitial,
} from "@/lib/providers";


// ─── Types ────────────────────────────────────────────────

interface LogEntry {
  id: string;
  text: string;
  type: "info" | "success" | "error" | "scan";
  timestamp: Date;
}

interface ClassifiedChange {
  title: string;
  date: string;
  source: string;
  change_type: "breaking" | "deprecation" | "feature";
  urgency: number;
  impact: string;
  action_required: string;
  suggested_fix?: string;
  code_example?: string;
  timeline: "immediate" | "soon" | "later";
  provider?: string;
}

interface DbProvider {
  id: string;
  name: string;
  slug: string;
  changelog_url: string;
  deprecation_url?: string | null;
  status_url?: string | null;
  is_custom: boolean;
}

// ─── Helpers ──────────────────────────────────────────────

function urgencyBorder(type: string) {
  switch (type) {
    case "breaking":
      return "border-l-red-500";
    case "deprecation":
      return "border-l-amber-500";
    default:
      return "border-l-green-500";
  }
}

function urgencyGlow(type: string) {
  switch (type) {
    case "breaking":
      return "animate-glow-red";
    case "deprecation":
      return "animate-glow-amber";
    default:
      return "animate-glow-green";
  }
}

function urgencyBadge(type: string) {
  switch (type) {
    case "breaking":
      return "bg-red-500/10 text-red-400 border-red-500/20";
    case "deprecation":
      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    default:
      return "bg-green-500/10 text-green-400 border-green-500/20";
  }
}

function typeLabel(type: string) {
  switch (type) {
    case "breaking":
      return "BREAKING";
    case "deprecation":
      return "DEPRECATION";
    default:
      return "FEATURE";
  }
}

function logIcon(type: LogEntry["type"]) {
  switch (type) {
    case "success":
      return (
        <span className="inline-block w-3 h-3 animate-check-pop">
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-green-400">
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    case "error":
      return <span className="text-red-500">✕</span>;
    case "scan":
      return <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-dot-pulse inline-block" />;
    default:
      return <span className="text-zinc-600">›</span>;
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// ─── Component ────────────────────────────────────────────

export default function DashboardPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [changes, setChanges] = useState<ClassifiedChange[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<Date | null>(null);
  const [lastScannedText, setLastScannedText] = useState("");
  const [scanStats, setScanStats] = useState<{
    succeeded: number;
    failed: number;
    totalMs: number;
  } | null>(null);
  const [waitingForEvents, setWaitingForEvents] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // All providers (built-in + custom) from database
  const [providers, setProviders] = useState<DbProvider[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [addError, setAddError] = useState("");

  // Load providers from database on mount
  useEffect(() => {
    async function loadProviders() {
      try {
        const res = await fetch("/api/providers");
        if (!res.ok) return;
        const data = await res.json();
        if (data.providers) setProviders(data.providers);
      } catch { /* network error */ }
    }
    loadProviders();
  }, []);

  const addCustomProvider = async () => {
    const trimName = newName.trim();
    const trimUrl = newUrl.trim();
    if (!trimName || !trimUrl) return;
    if (!/^https?:\/\//i.test(trimUrl)) return;
    setAddError("");
    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimName, changelog_url: trimUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error || "Failed to add");
        return;
      }
      setProviders((prev) => [...prev, data.provider]);
      setNewName("");
      setNewUrl("");
      setShowAddForm(false);
    } catch {
      setAddError("Network error");
    }
  };

  const removeCustomProvider = async (slug: string) => {
    try {
      await fetch(`/api/providers?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
      setProviders((prev) => prev.filter((p) => p.slug !== slug));
      setSelected((prev) => prev.filter((s) => s !== slug));
    } catch { /* ignore */ }
  };

  // Update "last scanned" text every 5s
  useEffect(() => {
    if (!lastScanned) return;
    const update = () => setLastScannedText(timeAgo(lastScanned));
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, [lastScanned]);

  // Fetch persisted changes on mount
  useEffect(() => {
    async function loadSavedChanges() {
      try {
        const res = await fetch("/api/changes?limit=50");
        if (!res.ok) return;
        const data = await res.json();
        if (data.changes && data.changes.length > 0) {
          const mapped: ClassifiedChange[] = data.changes.map(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (c: any) => ({
              title: c.title,
              date: c.date,
              source: c.source,
              change_type: c.change_type,
              urgency: c.urgency,
              impact: c.impact,
              action_required: c.action_required,
              suggested_fix: c.suggested_fix,
              code_example: c.code_example,
              timeline: c.timeline,
              provider: c.provider_name,
            })
          );
          setChanges(mapped);
        }
        if (data.lastScanAt) {
          setLastScanned(new Date(data.lastScanAt));
        }
      } catch {
        // silently ignore — first visit or network error
      }
    }
    loadSavedChanges();
  }, []);

  const addLog = useCallback(
    (text: string, type: LogEntry["type"] = "info") => {
      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          text,
          type,
          timestamp: new Date(),
        },
      ]);
      setTimeout(
        () => logEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        50
      );
    },
    []
  );

  // Delayed log helper — adds agent-style intermediate messages
  const agentLog = useCallback(
    (text: string, type: LogEntry["type"] = "scan", delayMs = 0) => {
      if (delayMs > 0) {
        return new Promise<void>((resolve) =>
          setTimeout(() => {
            addLog(text, type);
            resolve();
          }, delayMs)
        );
      }
      addLog(text, type);
      return Promise.resolve();
    },
    [addLog]
  );

  const toggle = (slug: string) => {
    if (scanning) return;
    setSelected((prev) =>
      prev.includes(slug) ? [] : [slug]
    );
  };

  const stopScan = useCallback(async () => {
    // 1. Abort the frontend SSE stream immediately
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    addLog("🛑 Cancelling scan...", "error");
    setScanning(false);
    setWaitingForEvents(false);

    // 2. Tell the backend to cancel pipeline + TinyFish runs
    try {
      const res = await fetch("/api/cancel-scan", { method: "POST" });
      const data = await res.json();
      if (data.cancelled) {
        addLog("✅ Scan stopped — all operations cancelled", "info");
        if (data.tinyfishRunsCancelled > 0) {
          addLog(`🐟 ${data.tinyfishRunsCancelled} TinyFish run(s) cancelled`, "info");
        }
      } else {
        addLog("✅ Scan stopped", "info");
      }
    } catch {
      addLog("✅ Scan stopped (backend cleanup skipped)", "info");
    }
  }, [addLog]);

  // Look up provider URL from DB providers
  const getProviderUrl = useCallback((name: string) => {
    const p = providers.find(
      (sp) => sp.name.toLowerCase() === name.toLowerCase()
    );
    return p?.changelog_url ?? "changelog page";
  }, [providers]);

  const startScan = async () => {
    if (selected.length === 0 || scanning) return;

    const controller = new AbortController();
    abortRef.current = controller;

    setScanning(true);
    setLogs([]);
    setChanges([]);
    setScanStats(null);
    setScanError(null);
    setWaitingForEvents(true);

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerSlugs: selected }),
        signal: controller.signal,
      });

      if (!res.ok) {
        setScanError(`Scan failed (HTTP ${res.status}). Please try again.`);
        setScanning(false);
        setWaitingForEvents(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setScanError("No response stream. Please try again.");
        setScanning(false);
        setWaitingForEvents(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          const trimmed = block.trim();
          if (!trimmed) continue;

          let eventType = "message";
          let eventData = "";

          for (const line of trimmed.split("\n")) {
            if (line.startsWith("event:")) eventType = line.slice(6).trim();
            if (line.startsWith("data:")) eventData = line.slice(5).trim();
          }

          if (!eventData) continue;

          try {
            const parsed = JSON.parse(eventData);

            setWaitingForEvents(false);

            switch (eventType) {
              // ─── PHASE 1: SYSTEM BOOT ──────────────────
              case "scan:start":
                addLog(
                  `Agent ID: canary-v1 • Mode: autonomous`,
                  "info"
                );
                await agentLog(
                  `🧠 Initializing Canary autonomous agent...`,
                  "scan",
                  350
                );
                await agentLog(
                  `🔐 Establishing secure session with target provider${(parsed.data?.providerCount ?? 1) > 1 ? "s" : ""}...`,
                  "scan",
                  400
                );
                await agentLog(
                  `⚡ System ready — beginning analysis of ${parsed.data?.providerCount ?? 1} provider(s)`,
                  "success",
                  250
                );
                break;

              // ─── PHASE 2: NAVIGATION ───────────────────
              case "provider:start": {
                const url = getProviderUrl(parsed.provider);
                const shortUrl = url.replace(/^https?:\/\/(www\.)?/, "");
                await agentLog(
                  `🌐 Navigating to ${parsed.provider} changelog...`,
                  "scan",
                  350
                );
                await agentLog(
                  `📄 Rendering page: ${shortUrl}`,
                  "info",
                  400
                );
                await agentLog(
                  `🔍 Locating latest API updates...`,
                  "scan",
                  300
                );
                break;
              }

              // ─── PHASE 3: EXTRACTION ───────────────────
              case "provider:scrape": {
                const entries = parsed.data?.entries ?? 0;
                const dur = (parsed.data?.durationMs / 1000).toFixed(1);
                await agentLog(
                  `📦 Parsing changelog entries from ${parsed.provider}...`,
                  "scan",
                  300
                );
                await agentLog(
                  `✅ ${entries} updates identified (${dur}s)`,
                  "success",
                  250
                );
                await agentLog(
                  `🧩 Structuring data for analysis...`,
                  "scan",
                  200
                );
                break;
              }

              // ─── DEPRECATION SCAN ──────────────────────
              case "provider:deprecation": {
                const depCount = parsed.data?.deprecations ?? 0;
                await agentLog(
                  `🔬 Scanning ${parsed.provider} deprecation notices...`,
                  "scan",
                  300
                );
                await agentLog(
                  depCount > 0
                    ? `⚠️ ${depCount} active deprecation${depCount > 1 ? "s" : ""} found — flagging for review`
                    : `🟢 No active deprecations detected`,
                  depCount > 0 ? "error" : "success",
                  200
                );
                break;
              }

              // ─── PHASE 4: DIFF ENGINE ──────────────────
              case "provider:diff": {
                const newEntries = parsed.data?.newEntries ?? 0;
                const isFirst = parsed.data?.isFirstScan;
                await agentLog(
                  `🧮 Comparing against previous snapshot...`,
                  "scan",
                  350
                );
                if (isFirst) {
                  await agentLog(
                    `📋 First scan for ${parsed.provider} — establishing baseline with ${parsed.data?.totalCurrent ?? 0} entries`,
                    "info",
                    250
                  );
                } else if (newEntries > 0) {
                  await agentLog(
                    `⚠️ ${newEntries} new change${newEntries > 1 ? "s" : ""} detected since last scan`,
                    "info",
                    250
                  );
                } else {
                  await agentLog(
                    `🟢 No new changes detected since last scan`,
                    "success",
                    200
                  );
                }
                break;
              }

              // ─── PHASE 5 & 6: AI ANALYSIS + REASONING ─
              case "provider:classify": {
                const count = parsed.data?.classified ?? 0;
                await agentLog(
                  `🤖 Analyzing changes using AI impact model...`,
                  "scan",
                  300
                );
                await agentLog(
                  `🧠 Understanding semantic meaning of ${count} update${count !== 1 ? "s" : ""}...`,
                  "scan",
                  350
                );
                await agentLog(
                  `📊 Evaluating potential impact on production systems...`,
                  "scan",
                  300
                );
                await agentLog(
                  `⚡ Assigning urgency scores...`,
                  "scan",
                  200
                );
                await agentLog(
                  `✅ Classification complete — ${count} change${count !== 1 ? "s" : ""} scored`,
                  "success",
                  250
                );
                break;
              }

              // ─── PROVIDER COMPLETE ─────────────────────
              case "provider:complete": {
                const dur = (parsed.data?.durationMs / 1000).toFixed(1);
                await agentLog(
                  `✓ ${parsed.provider} analysis complete (${dur}s)`,
                  "success",
                  200
                );
                break;
              }

              case "provider:error":
                addLog(
                  `❌ ${parsed.provider} — ${parsed.data?.error}`,
                  "error"
                );
                break;

              // ─── PHASE 7: FINAL RESULT ─────────────────
              case "scan:complete": {
                const succeeded = parsed.data?.succeeded ?? 0;
                const failed = parsed.data?.failed ?? 0;
                const totalClassified = parsed.data?.totalClassified ?? 0;
                const emailSent = parsed.data?.emailSent ?? false;
                const totalSec = (parsed.data?.totalDurationMs / 1000).toFixed(1);

                setScanStats({ succeeded, failed, totalMs: parsed.data?.totalDurationMs ?? 0 });

                await agentLog(
                  `📊 Scan summary: ${succeeded}/${succeeded + failed} providers analyzed`,
                  "success",
                  200
                );
                await agentLog(
                  `⏱ Total scan time: ${totalSec}s`,
                  "info",
                  150
                );

                // Dynamic reasoning based on results
                if (totalClassified === 0) {
                  await agentLog(
                    `🛡️ No breaking changes detected — system is up to date`,
                    "success",
                    300
                  );
                  await agentLog(
                    `💭 All monitored APIs appear stable. No action required.`,
                    "info",
                    200
                  );
                } else {
                  await agentLog(
                    `🚨 ${totalClassified} change${totalClassified !== 1 ? "s" : ""} classified — review recommended`,
                    "error",
                    300
                  );
                  await agentLog(
                    `🛠️ Generating actionable fix recommendations...`,
                    "scan",
                    250
                  );
                  await agentLog(
                    `💭 Some changes may impact existing integrations — see details below`,
                    "info",
                    200
                  );
                }

                if (emailSent) {
                  await agentLog(
                    `📧 Email alert dispatched for critical changes`,
                    "success",
                    200
                  );
                }

                await agentLog(
                  `✅ Agent session complete.`,
                  "success",
                  150
                );
                setLastScanned(new Date());
                break;
              }

              // ─── FINAL DATA ────────────────────────────
              case "done": {
                const providers = parsed.providers ?? [];
                const allChanges: ClassifiedChange[] = [];
                for (const p of providers) {
                  for (const c of p.classified ?? []) {
                    allChanges.push({ ...c, provider: p.provider });
                  }
                }
                if (allChanges.length > 0) setChanges(allChanges);
                break;
              }

              // ─── CANCELLED ────────────────────────────
              case "scan:cancelled": {
                const completed = parsed.data?.providersCompleted ?? 0;
                const remaining = parsed.data?.providersRemaining ?? 0;
                addLog(
                  `🛑 Scan cancelled — ${completed} provider(s) completed, ${remaining} skipped`,
                  "error"
                );
                setScanning(false);
                break;
              }

              case "error":
                addLog(`❌ Pipeline error: ${parsed.error}`, "error");
                setScanError("Scan failed. Please try again.");
                break;
            }
          } catch {
            // Skip
          }
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User stopped the scan — already handled in stopScan
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setScanError("Scan failed. Please try again.");
      addLog(`Connection failed: ${msg}`, "error");
    } finally {
      abortRef.current = null;
      setScanning(false);
      setWaitingForEvents(false);
    }
  };

  // Scan complete with no new changes
  const scanDoneNoChanges = !scanning && scanStats && changes.length === 0;

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* ─── Navbar ─────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">

        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition">
          <span className="text-xl font-logo font-bold tracking-wide text-white">
            🐤 Canary
          </span>
        </Link>

        {/* RIGHT SECTION */}
        <div className="flex items-center gap-5">

          {lastScannedText && (
            <span className="text-xs text-zinc-600">
              Last scanned: {lastScannedText}
            </span>
          )}

          {scanStats && (
            <span className="text-xs text-zinc-500 font-mono">
              {scanStats.succeeded}/{scanStats.succeeded + scanStats.failed} •{" "}
              {(scanStats.totalMs / 1000).toFixed(1)}s
            </span>
          )}

          {/* 🔥 SCAN REPO LINK */}
          <Link
            href="/scanrepo"
            className="text-xs text-zinc-400 hover:text-white transition flex items-center gap-2"
          >
            Scan Repo
            <span className="text-[10px] bg-purple-500/20 text-purple-400 px-2 py-[2px] rounded-full">
              new
            </span>
          </Link>

          {/* CURRENT PAGE */}
          <span className="text-xs text-white">Dashboard</span>

        </div>

      </nav>

      {/* ─── Main Grid ──────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-0">
        {/* ─── Left Panel: Provider Selector ────────────── */}
        <aside className="border-r border-zinc-800 p-6 space-y-6">
          <div>
            <h2 className="text-lg font-medium text-white mb-1">
              Select Providers
            </h2>
            <p className="text-xs text-zinc-500">
              Choose an API to scan
            </p>
          </div>

          <div className="space-y-2">
            {providers.map((provider) => {
              const isSelected = selected.includes(provider.slug);
              return (
                <div key={provider.slug} className={`relative ${provider.is_custom ? "group" : ""}`}>
                  <button
                    onClick={() => toggle(provider.slug)}
                    disabled={scanning}
                    className={`
                      w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all duration-200
                      ${!scanning ? "hover:-translate-y-0.5" : ""}
                      ${isSelected
                        ? "border-indigo-500 bg-indigo-500/10"
                        : scanning
                          ? "border-zinc-800 bg-zinc-950 opacity-40 cursor-not-allowed"
                          : "border-zinc-800 bg-zinc-950 hover:border-zinc-600"
                      }
                    `}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold shrink-0 ${provider.is_custom ? "bg-violet-500/20 text-violet-400" : ""
                        }`}
                      style={!provider.is_custom ? {
                        backgroundColor: `${getProviderColor(provider.slug)}20`,
                        color: getProviderColor(provider.slug),
                      } : undefined}
                    >
                      {getProviderInitial(provider.name)}
                    </div>

                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-white flex items-center gap-1.5">
                        {provider.name}
                        {provider.is_custom && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20 font-semibold">CUSTOM</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500 truncate max-w-[180px]">
                        {provider.changelog_url.replace(/^https?:\/\/(www\.)?/, "")}
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected ? "border-indigo-500 bg-indigo-500" : "border-zinc-700"
                      }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white animate-check-pop" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </button>

                  {/* Remove button — custom providers only */}
                  {provider.is_custom && (
                    <button
                      onClick={() => removeCustomProvider(provider.slug)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20 hover:border-red-500/30"
                      title="Remove provider"
                    >
                      <svg className="w-3 h-3 text-zinc-400 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })}

            {/* ─── Add Custom Provider ───────────────── */}
            {!showAddForm ? (
              <button
                onClick={() => { setShowAddForm(true); setAddError(""); }}
                disabled={scanning}
                className="w-full flex items-center gap-2.5 p-3 rounded-xl border border-dashed border-zinc-700 hover:border-zinc-500 transition-all text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-zinc-900 border border-zinc-800">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                Add Custom Provider
              </button>
            ) : (
              <div className="border border-zinc-700 rounded-xl bg-zinc-900/50 p-4 space-y-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-300">Add Provider</span>
                  <button onClick={() => { setShowAddForm(false); setNewName(""); setNewUrl(""); setAddError(""); }} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Provider name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <input
                  type="url"
                  placeholder="https://example.com/changelog"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg bg-zinc-900 border border-zinc-800 text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500 transition-colors"
                />
                <p className="text-[10px] text-zinc-600">Works best with structured changelog pages</p>
                {addError && <p className="text-[11px] text-red-400">{addError}</p>}
                <div className="flex gap-2">
                  <button
                    onClick={addCustomProvider}
                    disabled={!newName.trim() || !newUrl.trim() || !/^https?:\/\//i.test(newUrl)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium bg-indigo-500 text-white hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Add Provider
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewName(""); setNewUrl(""); setAddError(""); }}
                    className="px-4 py-2 rounded-lg text-xs text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Scan Button — Start/Stop Toggle */}
          {scanning ? (
            <button
              onClick={stopScan}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 relative bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20 active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm bg-red-400 animate-pulse" />
                Stop Scan
              </span>
            </button>
          ) : (
            <button
              onClick={startScan}
              disabled={selected.length === 0}
              className={`
                w-full py-3 rounded-xl text-sm font-medium transition-all duration-200 relative
                ${selected.length > 0
                  ? "bg-white text-black hover:scale-[1.03] active:scale-100 animate-scan-pulse"
                  : "bg-zinc-900 text-zinc-600 cursor-not-allowed"
                }
              `}
            >
              {selected.length > 0
                ? `Start Scan (${selected.length} provider${selected.length > 1 ? "s" : ""})`
                : "Select providers to scan"}
            </button>
          )}

          {/* Coming Soon */}
          <div className="space-y-2 pt-2">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-medium">
              Coming soon
            </p>
            <div className="space-y-1.5">
              {["Auto-Scan every 6 hours", "Email alerts on breaking changes", "Webhook notifications"].map(
                (item) => (
                  <div
                    key={item}
                    className="flex items-center gap-2 text-xs text-zinc-600"
                  >
                    <div className="w-1 h-1 rounded-full bg-zinc-700" />
                    {item}
                  </div>
                )
              )}
            </div>
          </div>

          <div className="text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs text-zinc-500 border border-zinc-800 rounded-full">
              Powered by TinyFish 🐟
            </span>
          </div>
        </aside>

        {/* ─── Right Panel ──────────────────────────────── */}
        <main className="p-6 space-y-6 overflow-y-auto max-h-[calc(100vh-65px)]">
          {/* Agent Progress Terminal */}
          <section>
            <h2 className="text-lg font-medium text-white mb-3">
              Agent Progress
            </h2>
            <div className="border border-zinc-800 rounded-xl bg-zinc-950 overflow-hidden">
              {/* Terminal Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-800">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-zinc-600 ml-2 font-mono">
                  canary-agent
                </span>
                {scanning && (
                  <span className="ml-auto flex items-center gap-1.5 text-xs text-green-400 font-mono">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-dot-pulse" />
                    live
                  </span>
                )}
              </div>

              {/* Terminal Body */}
              <div className="p-4 min-h-[180px] max-h-[280px] overflow-y-auto font-mono text-xs space-y-1.5">
                {/* Loading state: waiting for first event */}
                {waitingForEvents && (
                  <div className="flex items-center gap-2 text-indigo-400 animate-pulse-soft">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 animate-dot-pulse" />
                    Connecting to scan agent...
                  </div>
                )}

                {/* Empty state */}
                {logs.length === 0 && !waitingForEvents && (
                  <div className="flex items-center justify-center h-[140px] text-zinc-600">
                    <div className="text-center space-y-2">
                      <div className="text-xl">🐤</div>
                      <p className="text-sm">
                        Select providers and start a scan
                      </p>
                      <p className="text-zinc-700">
                        Live progress will appear here
                      </p>
                    </div>
                  </div>
                )}

                {/* Log entries with stagger */}
                {logs.map((log, i) => (
                  <div
                    key={log.id}
                    className="animate-slide-up flex items-start gap-2"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span className="text-zinc-700 shrink-0 w-[52px]">
                      {log.timestamp.toLocaleTimeString("en-US", {
                        hour12: false,
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </span>
                    <span className="shrink-0 w-4 flex items-center justify-center">
                      {logIcon(log.type)}
                    </span>
                    <span
                      className={
                        log.type === "error"
                          ? "text-red-400"
                          : log.type === "success"
                            ? "text-green-400"
                            : log.type === "scan"
                              ? "text-indigo-400"
                              : "text-zinc-400"
                      }
                    >
                      {log.text}
                    </span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </section>

          {/* Error State */}
          {scanError && (
            <div className="border border-red-500/20 rounded-xl bg-red-500/5 p-4 animate-fade-in flex items-center gap-3">
              <span className="text-red-400 text-lg">⚠</span>
              <div>
                <p className="text-sm text-red-400 font-medium">{scanError}</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Check your connection and try again
                </p>
              </div>
            </div>
          )}

          {/* Changes Feed */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-medium text-white">
                Detected Changes
              </h2>
              <div className="flex items-center gap-3">
                {lastScannedText && (
                  <span className="text-[10px] text-zinc-600">
                    Last scanned {lastScannedText}
                  </span>
                )}
                {changes.length > 0 && (
                  <span className="text-xs text-zinc-500">
                    {changes.length} change{changes.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {/* Stable empty state after scan */}
            {scanDoneNoChanges ? (
              <div className="border border-zinc-800 rounded-xl bg-zinc-950 p-6 animate-fade-in">
                <div className="flex items-center justify-center text-sm text-zinc-500">
                  <div className="text-center space-y-2">
                    <div className="text-2xl">✅</div>
                    <p className="text-zinc-400 font-medium">
                      No new changes detected
                    </p>
                    <p className="text-xs text-zinc-600">
                      Your APIs are stable. All monitored endpoints are up to
                      date.
                    </p>
                  </div>
                </div>
              </div>
            ) : changes.length === 0 ? (
              <div className="border border-zinc-800 rounded-xl bg-zinc-950 p-5">
                <div className="flex items-center justify-center h-24 text-sm text-zinc-600">
                  <div className="text-center space-y-2">
                    <div className="text-xl">📋</div>
                    <p>No changes detected yet</p>
                    <p className="text-xs text-zinc-700">
                      Run a scan to discover API changes
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {changes.map((change, i) => {
                  const isExpanded = expandedIdx === i;
                  return (
                    <div
                      key={`${change.title}-${i}`}
                      className={`
                        border border-zinc-800 border-l-4 ${urgencyBorder(change.change_type)}
                        rounded-xl bg-zinc-950 animate-slide-up
                        transition-all duration-200 cursor-pointer
                        ${!isExpanded ? "hover:-translate-y-1" : ""}
                        ${urgencyGlow(change.change_type)}
                      `}
                      style={{ animationDelay: `${i * 100}ms` }}
                      onClick={() => setExpandedIdx(isExpanded ? null : i)}
                    >
                      {/* Card Header */}
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1.5">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${urgencyBadge(change.change_type)}`}
                              >
                                {typeLabel(change.change_type)}
                              </span>
                              {change.provider && (
                                <span className="text-[10px] text-zinc-500 font-medium">
                                  {change.provider}
                                </span>
                              )}
                              <span className="text-[10px] text-zinc-600">
                                {change.date}
                              </span>
                            </div>

                            <h3 className="text-sm font-medium text-white leading-snug mb-1">
                              {change.title}
                            </h3>

                            <p className="text-xs text-zinc-500 leading-relaxed">
                              {change.impact}
                            </p>
                          </div>

                          <div className="shrink-0 flex flex-col items-center gap-1">
                            <div
                              className={`
                                w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold
                                ${change.urgency >= 8
                                  ? "bg-red-500/10 text-red-400"
                                  : change.urgency >= 5
                                    ? "bg-amber-500/10 text-amber-400"
                                    : "bg-green-500/10 text-green-400"
                                }
                              `}
                            >
                              {change.urgency}
                            </div>
                            <span className="text-[9px] text-zinc-600">
                              urgency
                            </span>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-zinc-800/50 flex items-center justify-between">
                          <span className="text-[10px] text-zinc-500">
                            {change.action_required}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-mono ${change.timeline === "immediate"
                                ? "text-red-400"
                                : change.timeline === "soon"
                                  ? "text-amber-400"
                                  : "text-zinc-500"
                                }`}
                            >
                              {change.timeline}
                            </span>
                            <svg
                              className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </div>

                      {/* Expanded AI Insight Panel */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                          }`}
                      >
                        <div className="px-4 pb-4 space-y-4 border-t border-zinc-800/50">
                          {/* AI Analysis Header */}
                          <div className="flex items-center gap-2 pt-3">
                            <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider">Recommended Action</span>
                            <div className="flex-1 h-px bg-zinc-800" />
                          </div>

                          {/* Impact */}
                          {change.impact && (
                            <div>
                              <h4 className="text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                <span>💥</span> Impact
                              </h4>
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {change.impact}
                              </p>
                            </div>
                          )}

                          {/* Action Required */}
                          {change.action_required && (
                            <div>
                              <h4 className="text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                <span>⚡</span> Action Required
                              </h4>
                              <p className="text-xs text-amber-300/90 leading-relaxed font-medium">
                                {change.action_required}
                              </p>
                            </div>
                          )}

                          {/* Suggested Fix */}
                          {change.suggested_fix && change.suggested_fix !== "// No code change needed" && (
                            <div>
                              <h4 className="text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                <span>🛠</span> Suggested Fix
                              </h4>
                              <p className="text-xs text-zinc-300 leading-relaxed">
                                {change.suggested_fix}
                              </p>
                            </div>
                          )}

                          {/* Code Example */}
                          {change.code_example && change.code_example !== "// No code change needed" && (
                            <div>
                              <h4 className="text-[11px] font-semibold text-zinc-400 mb-1 flex items-center gap-1.5">
                                <span>💻</span> Code Example
                              </h4>
                              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 overflow-x-auto">
                                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                                  {change.code_example}
                                </pre>
                              </div>
                            </div>
                          )}

                          {/* View Docs Link */}
                          <div className="pt-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                const prov = providers.find(
                                  (p) =>
                                    p.name.toLowerCase() ===
                                    (change.provider ?? "").toLowerCase()
                                );
                                const url = prov?.changelog_url;
                                if (url) window.open(url, "_blank", "noopener,noreferrer");
                              }}
                              title="Open original documentation"
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1.5"
                            >
                              <span>📚</span> Open Official Docs
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
