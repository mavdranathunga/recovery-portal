"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Store,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  HardDrive,
  Activity,
  ChevronRight,
  X,
  Terminal,
  Play,
  ServerCrash,
  BarChart3,
  ArrowRight,
  ShieldCheck,
  Compass,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { useOrg } from "@/lib/OrgContext";

export default function Home() {
  const router = useRouter();
  const { org } = useOrg();
  const [idtQuery, setIdtQuery] = useState("");
  const [shopQuery, setShopQuery] = useState("");
  const [syncQuery, setSyncQuery] = useState("");

  // Quick Sync Check States
  const [syncResult, setSyncResult] = useState<{ time: string | null; id: string; name: string } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleIdtSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (idtQuery.trim()) {
      router.push(`/idstn/${encodeURIComponent(idtQuery.trim())}?org=${org}`);
    }
  };

  const handleShopSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (shopQuery.trim()) {
      router.push(`/shop/${encodeURIComponent(shopQuery.trim())}?org=${org}`);
    }
  };

  const handleQuickSyncCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const branch = syncQuery.trim().toUpperCase();
    if (!branch) return;

    setSyncLoading(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      const res = await fetch(`/api/sync/${branch}?org=${org}`);
      const json = await res.json();

      if (json.error) {
        setSyncError(json.error);
      } else {
        setSyncResult({ time: json.last_sync_time, id: json.branch_id, name: json.branch_name });
      }
    } catch {
      setSyncError("Connection failed");
    } finally {
      setSyncLoading(false);
    }
  };

  const coreModules = [
    {
      title: "Operations Dashboard",
      subtitle: "Enterprise telemetry & KPIs",
      description:
        "Real-time sync telemetry, active store counts, Pronto sales ingestion, database tablespaces, and multi-tier server infrastructure metrics.",
      href: "/dashboard",
      icon: BarChart3,
      badge: "Core Telemetry",
      color: {
        text: "text-cyan-400",
        bg: "bg-cyan-500/10",
        border: "border-cyan-500/20",
        hoverBorder: "hover:border-cyan-500/40",
        btn: "bg-cyan-600/90 hover:bg-cyan-500 text-white shadow-cyan-600/20",
        gradient: "from-cyan-500/[0.04]",
      },
    },
    {
      title: "Service Recovery",
      subtitle: "Automated service healing",
      description:
        "Identify unsynced outlets exceeding thresholds, inspect stuck file queues, and perform isolated Tomcat & JVM recycling with live log streaming.",
      href: "/recovery",
      icon: ServerCrash,
      badge: "Self-Healing",
      color: {
        text: "text-rose-400",
        bg: "bg-rose-500/10",
        border: "border-rose-500/20",
        hoverBorder: "hover:border-rose-500/40",
        btn: "bg-rose-600/90 hover:bg-rose-500 text-white shadow-rose-600/20",
        gradient: "from-rose-500/[0.04]",
      },
    },
    {
      title: "System Diagnostics",
      subtitle: "Host health & terminal probe",
      description:
        "Live CPU & RAM ring meters, 6-partition disk storage bars, server uptime tracking, and interactive host CLI command execution.",
      href: "/diagnostics",
      icon: Activity,
      badge: "Infrastructure",
      color: {
        text: "text-emerald-400",
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        hoverBorder: "hover:border-emerald-500/40",
        btn: "bg-emerald-600/90 hover:bg-emerald-500 text-white shadow-emerald-600/20",
        gradient: "from-emerald-500/[0.04]",
      },
    },
    {
      title: "Mass Batch Runner",
      subtitle: "Multi-node script orchestrator",
      description:
        "Execute batch commands, maintenance scripts, health inspections, and cron tasks across 450+ outlets with configurable concurrency.",
      href: "/mass-runner",
      icon: Play,
      badge: "Automation",
      color: {
        text: "text-indigo-400",
        bg: "bg-indigo-500/10",
        border: "border-indigo-500/20",
        hoverBorder: "hover:border-indigo-500/40",
        btn: "bg-indigo-600/90 hover:bg-indigo-500 text-white shadow-indigo-600/20",
        gradient: "from-indigo-500/[0.04]",
      },
    },
    {
      title: "Offline Dump Monitor",
      subtitle: "Till synchronization & audit",
      description:
        "Audit offline till dumps across the network, inspect missing sales receipts, and trigger batch retrieval and ingestion scripts.",
      href: "/offline-dump",
      icon: HardDrive,
      badge: "Audit & Data",
      color: {
        text: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        hoverBorder: "hover:border-amber-500/40",
        btn: "bg-amber-600/90 hover:bg-amber-500 text-white shadow-amber-600/20",
        gradient: "from-amber-500/[0.04]",
      },
    },
  ];

  return (
    <div className="relative min-h-[85vh] flex flex-col items-center py-10 sm:py-16 overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-blue-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-60 left-1/4 w-[450px] h-[450px] bg-purple-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-96 right-1/4 w-[400px] h-[400px] bg-cyan-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />

      {/* Hero Header */}
      <div className="text-center mb-14 animate-in fade-in slide-in-from-bottom-3 duration-500 max-w-3xl px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span>Operational Command & Telemetry Node</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4 bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          Recovery Portal
        </h1>
        <p className="text-slate-400 text-sm sm:text-base md:text-lg leading-relaxed max-w-2xl mx-auto mb-8">
          Centralized control suite for 450+ retail branches and warehouses. Monitor network data replication, diagnose
          server infrastructure, and execute automated recovery routines.
        </p>

        {/* Quick Launch Action Pills 
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/25 flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            <span>Open Dashboard</span>
          </Link>
          <Link
            href="/recovery"
            className="px-5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/[0.08] hover:border-white/20 font-medium text-xs sm:text-sm transition-all flex items-center gap-2"
          >
            <ServerCrash className="h-4 w-4 text-rose-400" />
            <span>Service Recovery</span>
          </Link>
          <Link
            href="/diagnostics"
            className="px-5 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-white/[0.08] hover:border-white/20 font-medium text-xs sm:text-sm transition-all flex items-center gap-2"
          >
            <Terminal className="h-4 w-4 text-teal-400" />
            <span>Diagnostics</span>
          </Link>
        </div>
        */}
      </div>

      <div className="w-full max-w-7xl space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-500">
        {/* =======================================================================
            SECTION 1: QUICK INVESTIGATION & LOOKUP HUB (3 SEARCH UTILITIES)
           ======================================================================= */}
        <div>
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Search className="h-4 w-4 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Quick Search</h2>
                <p className="text-xs text-slate-400">Direct query utilities for transfers, branches, and replication timestamps</p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2.5 py-1 rounded-full border border-white/[0.06]">
              Instant Query
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 1. Track IDSTN Card */}
            <div className="group relative glass-card p-6 hover:border-blue-500/40 transition-all duration-300 flex flex-col overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-blue-500/10 rounded-xl group-hover:scale-105 transition-all duration-300 border border-blue-500/20">
                    <Search className="h-4.5 w-4.5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-blue-300 transition-colors tracking-tight">
                      Track IDSTN
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">Transfer payload journey</span>
                  </div>
                </div>
                <p className="text-slate-400 mb-5 text-xs leading-relaxed flex-1">
                  Trace an IDSTN payload across source store, Head Office database, and destination branch with transaction timestamps.
                </p>
                <form onSubmit={handleIdtSearch} className="flex flex-col gap-2 mt-auto">
                  <input
                    type="text"
                    placeholder="e.g. S348-DP000000602"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/30 transition-all text-xs font-mono"
                    value={idtQuery}
                    onChange={(e) => setIdtQuery(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-blue-600/90 hover:bg-blue-600 text-white font-medium py-2 rounded-xl transition-all duration-300 flex justify-center items-center gap-1.5 group/btn border border-blue-500/30 text-xs shadow-md shadow-blue-600/20"
                  >
                    <span>Track Journey</span>
                    <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </form>
              </div>
            </div>

            {/* 2. Monitor Shop Card */}
            <div className="group relative glass-card p-6 hover:border-purple-500/40 transition-all duration-300 flex flex-col overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-purple-500/10 rounded-xl group-hover:scale-105 transition-all duration-300 border border-purple-500/20">
                    <Store className="h-4.5 w-4.5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-purple-300 transition-colors tracking-tight">
                      Shop Activity
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">Branch ledger & IDSTN batches</span>
                  </div>
                </div>
                <p className="text-slate-400 mb-5 text-xs leading-relaxed flex-1">
                  Inspect incoming and outgoing IDSTN batches, transaction logs, and local database sync metrics for any retail outlet.
                </p>
                <form onSubmit={handleShopSearch} className="flex flex-col gap-2 mt-auto">
                  <input
                    type="text"
                    placeholder="e.g. S001"
                    className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/80 focus:ring-1 focus:ring-purple-500/30 transition-all text-xs font-mono"
                    value={shopQuery}
                    onChange={(e) => setShopQuery(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="w-full bg-purple-600/90 hover:bg-purple-600 text-white font-medium py-2 rounded-xl transition-all duration-300 flex justify-center items-center gap-1.5 group/btn border border-purple-500/30 text-xs shadow-md shadow-purple-600/20"
                  >
                    <span>View Activity</span>
                    <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </form>
              </div>
            </div>

            {/* 3. Quick Sync Status Card */}
            <div className="group relative glass-card p-6 hover:border-emerald-500/40 transition-all duration-300 flex flex-col overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex flex-col h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 bg-emerald-500/10 rounded-xl group-hover:scale-105 transition-all duration-300 border border-emerald-500/20">
                    <Clock className="h-4.5 w-4.5 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors tracking-tight">
                      Last Sync Probe
                    </h3>
                    <span className="text-[11px] text-slate-500 font-mono">Head Office replication</span>
                  </div>
                </div>
                <p className="text-slate-400 mb-5 text-xs leading-relaxed flex-1">
                  Verify the exact timestamp when a remote branch POS/DB last transmitted transactional batches to central servers.
                </p>
                <form onSubmit={handleQuickSyncCheck} className="flex flex-col gap-2 mt-auto">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="e.g. S880"
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 focus:ring-1 focus:ring-emerald-500/30 transition-all text-xs font-mono"
                      value={syncQuery}
                      onChange={(e) => setSyncQuery(e.target.value)}
                      required
                    />
                    {syncLoading && (
                      <div className="absolute right-3 top-2.5">
                        <RefreshCw className="h-4 w-4 text-emerald-400 animate-spin" />
                      </div>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={syncLoading}
                    className="w-full bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2 rounded-xl transition-all duration-300 flex justify-center items-center gap-1.5 group/btn border border-emerald-500/30 text-xs shadow-md shadow-emerald-600/20"
                  >
                    <span>Check Sync Time</span>
                    <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </form>

                {/* Sync Result Area */}
                {syncError && (
                  <div className="mt-2.5 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between gap-2 text-rose-300 text-xs animate-in slide-in-from-top-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>{syncError}</span>
                    </div>
                    <button onClick={() => setSyncError(null)} className="text-rose-400 hover:text-white">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {syncResult && (
                  <div className="mt-2.5 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl relative text-xs animate-in slide-in-from-top-2">
                    <button
                      onClick={() => setSyncResult(null)}
                      className="absolute top-2.5 right-2.5 text-emerald-400 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="flex items-center gap-1.5 font-bold font-mono text-emerald-400 uppercase mb-0.5">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {syncResult.id} — {syncResult.name}
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      Last Sync:{" "}
                      <span className="text-white font-semibold">
                        {syncResult.time ? formatDate(syncResult.time) : "Never Synced"}
                      </span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* =======================================================================
            SECTION 2: CORE OPERATIONS SUITE (5 PRIMARY APPLICATIONS)
           ======================================================================= */}
        <div>
          <div className="flex items-center justify-between mb-6 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                <Compass className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Command Suite</h2>
                <p className="text-xs text-slate-400">Core operational platforms and automated tooling</p>
              </div>
            </div>
            <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2.5 py-1 rounded-full border border-white/[0.06]">
              5 Platforms
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {coreModules.map((module) => {
              const Icon = module.icon;
              return (
                <div
                  key={module.title}
                  className={`group relative glass-card p-6 ${module.color.hoverBorder} transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-lg`}
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${module.color.gradient} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                  />

                  <div className="relative z-10 flex flex-col h-full">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-3 ${module.color.bg} rounded-xl group-hover:scale-105 transition-all duration-300 border ${module.color.border}`}
                        >
                          <Icon className={`h-5 w-5 ${module.color.text}`} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-white group-hover:text-white transition-colors tracking-tight">
                            {module.title}
                          </h3>
                          <span className="text-[11px] text-slate-500 font-mono">{module.subtitle}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-950/80 text-slate-400 border border-white/[0.06]">
                        {module.badge}
                      </span>
                    </div>

                    <p className="text-slate-400 mb-6 text-xs leading-relaxed flex-1">{module.description}</p>

                    <Link
                      href={module.href}
                      className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center justify-between group/btn border border-white/[0.06] bg-slate-900/80 text-white hover:bg-slate-800`}
                    >
                      <span>Launch Module</span>
                      <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
