"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Store, Clock, RefreshCw, AlertCircle, CheckCircle2, HardDrive, Activity, ChevronRight, Zap, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function Home() {
  const router = useRouter();
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
      router.push(`/idt/${encodeURIComponent(idtQuery.trim())}`);
    }
  };

  const handleShopSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (shopQuery.trim()) {
      router.push(`/shop/${encodeURIComponent(shopQuery.trim())}`);
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
      const res = await fetch(`/api/sync/${branch}`);
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
    <div className="relative min-h-[85vh] flex flex-col items-center py-16 px-4">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[300px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
          <Zap className="h-4 w-4" />
          <span>System Monitoring & Recovery</span>
        </div>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
          Recovery Portal
        </h1>
        <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
          Unified command center for 450+ retail outlets. Monitor synchronization, diagnose issues, and execute recoveries in real-time.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-7xl animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150">

        {/* Track IDT Card */}
        <div className="group relative bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:bg-slate-800/50 hover:border-blue-500/50 transition-all duration-500 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3.5 bg-blue-500/10 rounded-xl group-hover:scale-110 group-hover:bg-blue-500/20 transition-all duration-300">
                <Search className="h-6 w-6 text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">Track IDT</h2>
            </div>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed flex-1">
              Enter an IDT number to trace its complete journey across source, Head Office, and destination databases.
            </p>
            <form onSubmit={handleIdtSearch} className="flex flex-col gap-3 mt-auto">
              <input
                type="text"
                placeholder="e.g. S348-DP000000602"
                className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                value={idtQuery}
                onChange={(e) => setIdtQuery(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-blue-600 text-white font-medium py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-slate-700 hover:border-blue-500 hover:shadow-[0_0_20px_rgba(37,99,235,0.3)]"
              >
                Track Journey
                <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        </div>

        {/* Monitor Shop Card */}
        <div className="group relative bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:bg-slate-800/50 hover:border-purple-500/50 transition-all duration-500 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3.5 bg-purple-500/10 rounded-xl group-hover:scale-110 group-hover:bg-purple-500/20 transition-all duration-300">
                <Store className="h-6 w-6 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-purple-400 transition-colors">Shop Activity</h2>
            </div>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed flex-1">
              View the latest incoming and outgoing IDT transfers for any specific branch or warehouse in the network.
            </p>
            <form onSubmit={handleShopSearch} className="flex flex-col gap-3 mt-auto">
              <input
                type="text"
                placeholder="e.g. S001"
                className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                value={shopQuery}
                onChange={(e) => setShopQuery(e.target.value)}
                required
              />
              <button
                type="submit"
                className="w-full bg-slate-800 hover:bg-purple-600 text-white font-medium py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-slate-700 hover:border-purple-500 hover:shadow-[0_0_20px_rgba(147,51,234,0.3)]"
              >
                View Activity
                <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </form>
          </div>
        </div>

        {/* Quick Sync Status Card */}
        <div className="group relative bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:bg-slate-800/50 hover:border-emerald-500/50 transition-all duration-500 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3.5 bg-emerald-500/10 rounded-xl group-hover:scale-110 group-hover:bg-emerald-500/20 transition-all duration-300">
                <Clock className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">Last Sync Time</h2>
            </div>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed flex-1">
              Instantly check when a shop last synchronized its local database with the Head Office servers.
            </p>
            <form onSubmit={handleQuickSyncCheck} className="flex flex-col gap-3 mt-auto">
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. S880"
                  className="w-full bg-black/40 border border-slate-700 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
                  value={syncQuery}
                  onChange={(e) => setSyncQuery(e.target.value)}
                  required
                />
                {syncLoading && (
                  <div className="absolute right-4 top-3.5">
                    <RefreshCw className="h-5 w-5 text-emerald-500 animate-spin" />
                  </div>
                )}
              </div>
              <button
                type="submit"
                disabled={syncLoading}
                className="w-full bg-slate-800 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-slate-700 hover:border-emerald-500 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
              >
                Check Sync Time
                <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </form>

            {/* Sync Result Area overlaying the bottom slightly if present */}
            <div className="absolute bottom-16 left-0 right-0 z-20">
              {syncError && (
                <div className="relative p-4 bg-red-950/95 border border-red-500/70 rounded-xl flex items-center gap-3 text-red-200 text-sm shadow-[0_10px_30px_rgba(220,38,38,0.3)] animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-md">
                  <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                  <span className="flex-1">{syncError}</span>
                  <button onClick={() => setSyncError(null)} className="p-1 hover:bg-red-900/50 rounded-md transition-colors text-red-400 hover:text-red-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {syncResult && (
                <div className="relative p-10 bg-emerald-950/95 border border-emerald-500/70 rounded-xl shadow-[0_10px_30px_rgba(16,185,129,0.25)] animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-md">
                  <button onClick={() => setSyncResult(null)} className="absolute top-3 right-3 p-1 hover:bg-emerald-900/50 rounded-md transition-colors text-emerald-400 hover:text-emerald-300">
                    <X className="h-5 w-5" />
                  </button>
                  <div className="flex items-center gap-2 mb-2 pr-6">
                    <span className="text-md text-emerald-400 font-bold uppercase tracking-wider">{syncResult.id}</span>
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  </div>
                  <p className="text-white font-medium text-lg mb-1 truncate pr-6">
                    {syncResult.name}
                  </p>
                  <p className="text-emerald-200/90 text-md">
                    Last: {syncResult.time ? formatDate(syncResult.time) : "Never Synced"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sync Recovery Card */}
        <div className="group relative bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:bg-slate-800/50 hover:border-rose-500/50 transition-all duration-500 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3.5 bg-rose-500/10 rounded-xl group-hover:scale-110 group-hover:bg-rose-500/20 transition-all duration-300">
                <AlertCircle className="h-6 w-6 text-rose-400" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-rose-400 transition-colors">Sync Recovery</h2>
            </div>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed flex-1">
              Detect unsynced shops, diagnose crashed cronjobs, and execute remote recovery scripts safely via SSH.
            </p>
            <button
              onClick={() => router.push('/recovery')}
              className="w-full bg-slate-800 hover:bg-rose-600 text-white font-medium py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-slate-700 hover:border-rose-500 hover:shadow-[0_0_20px_rgba(225,29,72,0.3)] mt-auto"
            >
              Launch Manager
              <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Offline Dump Monitor Card */}
        <div className="group relative bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:bg-slate-800/50 hover:border-amber-500/50 transition-all duration-500 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3.5 bg-amber-500/10 rounded-xl group-hover:scale-110 group-hover:bg-amber-500/20 transition-all duration-300">
                <HardDrive className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-amber-400 transition-colors">Offline Dump</h2>
            </div>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed flex-1">
              Monitor offline till data dumps across the network and automate missing data retrieval processes.
            </p>
            <button
              onClick={() => router.push('/offline-dump')}
              className="w-full bg-slate-800 hover:bg-amber-600 text-white font-medium py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-slate-700 hover:border-amber-500 hover:shadow-[0_0_20px_rgba(217,119,6,0.3)] mt-auto"
            >
              Open Monitor
              <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* System Diagnostics Card */}
        <div className="group relative bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-8 hover:bg-slate-800/50 hover:border-teal-500/50 transition-all duration-500 flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-center gap-4 mb-5">
              <div className="p-3.5 bg-teal-500/10 rounded-xl group-hover:scale-110 group-hover:bg-teal-500/20 transition-all duration-300">
                <Activity className="h-6 w-6 text-teal-400" />
              </div>
              <h2 className="text-xl font-bold text-white group-hover:text-teal-400 transition-colors">Diagnostics</h2>
            </div>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed flex-1">
              View live telemetry (CPU, RAM, Disk), analyze Oracle/Tomcat health, and execute CLI commands.
            </p>
            <button
              onClick={() => router.push('/diagnostics')}
              className="w-full bg-slate-800 hover:bg-teal-600 text-white font-medium py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group/btn border border-slate-700 hover:border-teal-500 hover:shadow-[0_0_20px_rgba(13,148,136,0.3)] mt-auto"
            >
              Launch Console
              <ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}


