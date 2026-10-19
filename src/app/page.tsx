"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Store, Clock, RefreshCw, AlertCircle, CheckCircle2, HardDrive, Activity, ChevronRight, Zap, X, Database, Terminal } from "lucide-react";
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
      router.push(`/idt/${encodeURIComponent(idtQuery.trim())}?org=${org}`);
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
    } catch (err) {
      setSyncError("Connection failed");
    } finally {
      setSyncLoading(false);
    }
  };


  return (
    <div className="relative min-h-[85vh] flex flex-col items-center py-16 overflow-x-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Hero Header */}
      <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-3 duration-500 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-5 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          <span>Operational Health & Telemetry</span>
        </div>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-4 bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
          Recovery Portal
        </h1>
        <p className="text-slate-400 text-base md:text-lg leading-relaxed">
          Centralized command node for 450+ retail branches and warehouses. Monitor live data sync, diagnose server outages, and automate recoveries.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-7xl animate-in fade-in slide-in-from-bottom-5 duration-500">

        {/* Track IDT Card */}
        <div className="group relative glass-card p-7 hover:border-blue-500/40 transition-all duration-300 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-blue-500/10 rounded-xl group-hover:scale-105 group-hover:bg-blue-500/20 transition-all duration-300 border border-blue-500/20">
                <Search className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-blue-300 transition-colors tracking-tight">Track IDT</h2>
                <span className="text-[11px] text-slate-500 font-mono">Trace transfer lifecycle</span>
              </div>
            </div>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed flex-1">
              Trace an IDT payload across source store, Head Office database, and target destination with transaction timestamps.
            </p>
            <form onSubmit={handleIdtSearch} className="flex flex-col gap-2.5 mt-auto">
              <input
                type="text"
                placeholder="e.g. S348-DP000000602"
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all text-xs font-mono"
                value={idtQuery}
                onChange={(e) => setIdtQuery(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full bg-blue-600/90 hover:bg-blue-600 text-white font-medium py-2.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-blue-500/30 text-xs shadow-md shadow-blue-600/20"
              >
                Track Journey
                <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </form>
          </div>
        </div>

        {/* Monitor Shop Card */}
        <div className="group relative glass-card p-7 hover:border-purple-500/40 transition-all duration-300 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-purple-500/10 rounded-xl group-hover:scale-105 group-hover:bg-purple-500/20 transition-all duration-300 border border-purple-500/20">
                <Store className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-purple-300 transition-colors tracking-tight">Shop Activity</h2>
                <span className="text-[11px] text-slate-500 font-mono">Branch ledger & transfers</span>
              </div>
            </div>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed flex-1">
              Inspect latest incoming and outgoing IDT batches, transaction logs, and local database sync metrics for any specific outlet.
            </p>
            <form onSubmit={handleShopSearch} className="flex flex-col gap-2.5 mt-auto">
              <input
                type="text"
                placeholder="e.g. S001"
                className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-purple-500/80 focus:ring-2 focus:ring-purple-500/20 transition-all text-xs font-mono"
                value={shopQuery}
                onChange={(e) => setShopQuery(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full bg-purple-600/90 hover:bg-purple-600 text-white font-medium py-2.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-purple-500/30 text-xs shadow-md shadow-purple-600/20"
              >
                View Activity
                <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </form>
          </div>
        </div>

        {/* Quick Sync Status Card */}
        <div className="group relative glass-card p-7 hover:border-emerald-500/40 transition-all duration-300 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-emerald-500/10 rounded-xl group-hover:scale-105 group-hover:bg-emerald-500/20 transition-all duration-300 border border-emerald-500/20">
                <Clock className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-emerald-300 transition-colors tracking-tight">Last Sync Time</h2>
                <span className="text-[11px] text-slate-500 font-mono">Head Office replication</span>
              </div>
            </div>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed flex-1">
              Verify the exact timestamp when a remote branch POS/DB last transmitted transactional batches to the central server.
            </p>
            <form onSubmit={handleQuickSyncCheck} className="flex flex-col gap-2.5 mt-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. S880"
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20 transition-all text-xs font-mono"
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
                className="w-full bg-emerald-600/90 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-emerald-500/30 text-xs shadow-md shadow-emerald-600/20"
              >
                Check Sync Time
                <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
              </button>
            </form>

            {/* Sync Result Area */}
            {syncError && (
              <div className="mt-3 p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-between gap-2 text-rose-300 text-xs animate-in slide-in-from-top-2">
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
              <div className="mt-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl relative text-xs animate-in slide-in-from-top-2">
                <button onClick={() => setSyncResult(null)} className="absolute top-2.5 right-2.5 text-emerald-400 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-1.5 font-bold font-mono text-emerald-400 uppercase mb-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {syncResult.id} — {syncResult.name}
                </div>
                <p className="text-slate-300">
                  Last Sync: <span className="text-white font-semibold">{syncResult.time ? formatDate(syncResult.time) : "Never Synced"}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Sync Recovery Card */}
        <div className="group relative glass-card p-7 hover:border-rose-500/40 transition-all duration-300 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-rose-500/10 rounded-xl group-hover:scale-105 group-hover:bg-rose-500/20 transition-all duration-300 border border-rose-500/20">
                <AlertCircle className="h-5 w-5 text-rose-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-rose-300 transition-colors tracking-tight">Sync Recovery</h2>
                <span className="text-[11px] text-slate-500 font-mono">Unsynced cron & recovery</span>
              </div>
            </div>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed flex-1">
              Detect disconnected stores, inspect crashed background cronjobs, and execute safe automated SSH sync scripts.
            </p>
            <button
              onClick={() => router.push('/recovery')}
              className="w-full bg-slate-900/80 hover:bg-rose-600 text-white font-medium py-2.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-white/10 hover:border-rose-500/40 text-xs mt-auto shadow-sm"
            >
              Launch Manager
              <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Offline Dump Monitor Card */}
        <div className="group relative glass-card p-7 hover:border-amber-500/40 transition-all duration-300 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-amber-500/10 rounded-xl group-hover:scale-105 group-hover:bg-amber-500/20 transition-all duration-300 border border-amber-500/20">
                <HardDrive className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-amber-300 transition-colors tracking-tight">Offline Dump</h2>
                <span className="text-[11px] text-slate-500 font-mono">Till sync & dump audit</span>
              </div>
            </div>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed flex-1">
              Audit offline till dumps across the network, inspect missing receipts, and dispatch retrieval scripts.
            </p>
            <button
              onClick={() => router.push('/offline-dump')}
              className="w-full bg-slate-900/80 hover:bg-amber-600 text-white font-medium py-2.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-white/10 hover:border-amber-500/40 text-xs mt-auto shadow-sm"
            >
              Open Monitor
              <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* System Diagnostics Card */}
        <div className="group relative glass-card p-7 hover:border-teal-500/40 transition-all duration-300 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-teal-500/10 rounded-xl group-hover:scale-105 group-hover:bg-teal-500/20 transition-all duration-300 border border-teal-500/20">
                <Activity className="h-5 w-5 text-teal-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-teal-300 transition-colors tracking-tight">Diagnostics</h2>
                <span className="text-[11px] text-slate-500 font-mono">Telemetry & terminal</span>
              </div>
            </div>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed flex-1">
              View live telemetry (CPU, RAM, Disk partitions), inspect Oracle database health, and execute CLI commands.
            </p>
            <button
              onClick={() => router.push('/diagnostics')}
              className="w-full bg-slate-900/80 hover:bg-teal-600 text-white font-medium py-2.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-white/10 hover:border-teal-500/40 text-xs mt-auto shadow-sm"
            >
              Open Console
              <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Mass Runner Card */}
        <div className="group relative glass-card p-7 hover:border-indigo-500/40 transition-all duration-300 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-3.5 mb-4">
              <div className="p-3 bg-indigo-500/10 rounded-xl group-hover:scale-105 group-hover:bg-indigo-500/20 transition-all duration-300 border border-indigo-500/20">
                <Terminal className="h-5 w-5 text-indigo-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors tracking-tight">Mass Runner</h2>
                <span className="text-[11px] text-slate-500 font-mono">Multi-node batch executor</span>
              </div>
            </div>
            <p className="text-slate-400 mb-6 text-xs leading-relaxed flex-1">
              Execute batch commands, scripts, health inspections, and multi-server operations across branches simultaneously.
            </p>
            <button
              onClick={() => router.push('/mass-runner')}
              className="w-full bg-slate-900/80 hover:bg-indigo-600 text-white font-medium py-2.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-white/10 hover:border-indigo-500/40 text-xs mt-auto shadow-sm"
            >
              Launch Runner
              <ChevronRight className="h-3.5 w-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


