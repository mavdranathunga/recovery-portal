"use client";

import { useEffect, useState, use } from "react";
import {
  Store,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  Search,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  ChevronLeft,
  ServerCrash,
  Terminal,
  Layers,
  X,
  Radio,
} from "lucide-react";
import { formatDate, getStatusColor, cn } from "@/lib/utils";
import Link from "next/link";
import { useOrg } from "@/lib/OrgContext";

interface ShopIdtRecord {
  dpn_id: string;
  dpn_src_branchid: string;
  dpn_dest_branchid: string;
  dpn_status: string;
  status_text: string;
  effective_date: string;
  rec_date: string;
  lupd_date: string;
  sync_date: string;
  dpn_commit_date: string;
  direction: "INCOMING" | "OUTGOING";
}

interface ShopResponse {
  branch_id: string;
  branch_name: string;
  branch_ip?: string | null;
  records: ShopIdtRecord[];
  last_sync_time?: string | null;
  dataSource?: "OUTLET" | "HEAD_OFFICE";
  outletConnected?: boolean;
  connectionWarning?: string | null;
  error?: string;
  details?: string;
}

export default function ShopMonitorPage({ params }: { params: Promise<{ branch_id: string }> }) {
  const unwrappedParams = use(params);
  const branch_id = unwrappedParams.branch_id.toUpperCase();
  const { org } = useOrg();

  const [data, setData] = useState<ShopResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "INCOMING" | "OUTGOING">("ALL");
  const [idtSearch, setIdtSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchShopData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/shop/${branch_id}?limit=100&org=${org}`);
      if (!res.ok) {
        throw new Error("Failed to fetch shop data. Status: " + res.status);
      }
      const json = await res.json();
      if (json.error) {
        setError(json.error + (json.details ? `: ${json.details}` : ""));
      } else {
        setData(json);
      }
    } catch (err: any) {
      setError(err.message || "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShopData();
  }, [branch_id, org]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4 shadow-lg shadow-purple-500/10">
          <RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Loading Shop Ledger...</h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-1.5 font-mono">
          Querying Head Office & Outlet databases for {branch_id}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] animate-in fade-in duration-300 px-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-rose-400" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Shop Query Failed</h2>
        <p className="text-rose-300 text-sm max-w-lg text-center mb-6">{error}</p>
        <Link
          href="/"
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl border border-white/10 transition-colors"
        >
          Return to Command Center
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const totalOutgoing = data.records.filter((r) => r.direction === "OUTGOING").length;
  const totalIncoming = data.records.filter((r) => r.direction === "INCOMING").length;

  const filteredRecords = data.records.filter((r) => {
    const matchesDirection = filter === "ALL" || r.direction === filter;
    const matchesIdt = r.dpn_id.toUpperCase().includes(idtSearch.toUpperCase());
    return matchesDirection && matchesIdt;
  });

  return (
    <div className="animate-in fade-in duration-500 pb-12 space-y-6">
      {/* =======================================================================
          TOP HEADER: Breadcrumb, Title, Quick Actions & Connection Badges
         ======================================================================= */}
      <div className="glass-card p-5 sm:p-7 rounded-2xl border border-white/[0.08] relative overflow-hidden backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent" />

        {/* Breadcrumb & Navigation */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors group"
          >
            <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Command Center</span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              href={`/diagnostics?branch=${data.branch_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-medium border border-white/[0.06] transition-colors"
            >
              <Terminal className="h-3.5 w-3.5 text-teal-400" />
              <span className="hidden sm:inline">Diagnostics</span>
            </Link>

            <Link
              href={`/recovery?branch=${data.branch_id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 text-xs font-medium border border-rose-500/30 transition-colors"
            >
              <ServerCrash className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden sm:inline">Recovery</span>
            </Link>

            <button
              onClick={fetchShopData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-white/[0.08] transition-colors"
              title="Refresh Ledger"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-purple-400")} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Title & Connection Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="px-3 py-1 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 text-purple-300 font-mono font-extrabold text-lg sm:text-xl border border-purple-500/30 tracking-wider shadow-sm flex items-center gap-2">
                <Store className="h-4.5 w-4.5 text-purple-400" />
                {data.branch_id}
              </span>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
                {data.branch_name}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Data Source Badge */}
              {data.dataSource === "OUTLET" ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shadow-sm shadow-emerald-500/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live Outlet DB {data.branch_ip ? `(${data.branch_ip})` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  Head Office Replica Data
                </span>
              )}

              {data?.last_sync_time && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-black/40 border border-white/[0.06] text-slate-300 font-mono">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  Last HO sync: {formatDate(data.last_sync_time)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Warning Banner if unreachable */}
        {data.connectionWarning && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5 animate-in slide-in-from-top-1">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span className="leading-relaxed">{data.connectionWarning}</span>
          </div>
        )}
      </div>

      {/* =======================================================================
          METRICS RIBBON (4 KPI CARDS)
         ======================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block mb-0.5">Total Transfers</span>
            <span className="text-xl sm:text-2xl font-black text-white">{data.records.length}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
            <Layers className="h-5 w-5 text-purple-400" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block mb-0.5">Outgoing IDSTNs</span>
            <span className="text-xl sm:text-2xl font-black text-orange-400">{totalOutgoing}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <ArrowUpRight className="h-5 w-5 text-orange-400" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block mb-0.5">Incoming IDSTNs</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400">{totalIncoming}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <ArrowDownLeft className="h-5 w-5 text-emerald-400" />
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/[0.06] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-mono text-slate-400 block mb-0.5">Connection Channel</span>
            <span className="text-xs sm:text-sm font-bold text-white truncate block max-w-[120px]">
              {data.dataSource === "OUTLET" ? "Direct Socket" : "Central Sync"}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Radio className="h-5 w-5 text-blue-400" />
          </div>
        </div>
      </div>

      {/* =======================================================================
          TOOLBAR: Direction Filter Tabs & IDSTN Number Search
         ======================================================================= */}
      <div className="glass-card p-4 rounded-xl border border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Direction Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-white/[0.08] shrink-0">
          <button
            onClick={() => setFilter("ALL")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              filter === "ALL"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            )}
          >
            <span>All</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300 font-mono">
              {data.records.length}
            </span>
          </button>

          <button
            onClick={() => setFilter("OUTGOING")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              filter === "OUTGOING"
                ? "bg-orange-500/30 text-orange-200 border border-orange-500/40 shadow-sm"
                : "text-slate-400 hover:text-orange-300"
            )}
          >
            <ArrowUpRight className="h-3.5 w-3.5 text-orange-400" />
            <span>Outgoing</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300 font-mono font-bold">
              {totalOutgoing}
            </span>
          </button>

          <button
            onClick={() => setFilter("INCOMING")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5",
              filter === "INCOMING"
                ? "bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 shadow-sm"
                : "text-slate-400 hover:text-emerald-300"
            )}
          >
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-400" />
            <span>Incoming</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-bold">
              {totalIncoming}
            </span>
          </button>
        </div>

        {/* Search Box */}
        <div className="relative min-w-[200px] sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search IDSTN (e.g. DP00...)..."
            value={idtSearch}
            onChange={(e) => setIdtSearch(e.target.value)}
            className="w-full bg-slate-900/90 border border-white/[0.08] rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 font-mono"
          />
          {idtSearch && (
            <button
              onClick={() => setIdtSearch("")}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* =======================================================================
          MOBILE CARDS VIEW (< md)
         ======================================================================= */}
      <div className="block md:hidden space-y-3">
        {filteredRecords.length === 0 ? (
          <div className="glass-card p-10 text-center text-slate-500 text-xs rounded-2xl">
            No matching records found for {branch_id}
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div
              key={rec.dpn_id}
              className="glass-card p-4 rounded-xl space-y-3 border border-white/[0.06] hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-purple-300 font-bold text-sm">{rec.dpn_id}</span>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1",
                    rec.direction === "OUTGOING"
                      ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  )}
                >
                  {rec.direction === "OUTGOING" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                  {rec.direction}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Target Store</span>
                  <span className="font-mono font-semibold text-slate-200">
                    {rec.direction === "OUTGOING" ? rec.dpn_dest_branchid : rec.dpn_src_branchid}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-mono block">Status</span>
                  <span className={cn("px-2 py-0.5 rounded text-[11px] font-bold border inline-block mt-0.5", getStatusColor(rec.dpn_status))}>
                    {rec.status_text.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 space-y-1 pt-1 border-t border-white/[0.04]">
                {rec.rec_date && (
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span className="text-slate-300 font-mono">{formatDate(rec.rec_date)}</span>
                  </div>
                )}
                {rec.sync_date && (
                  <div className="flex justify-between">
                    <span>HO Synced:</span>
                    <span className="text-slate-300 font-mono">{formatDate(rec.sync_date)}</span>
                  </div>
                )}
              </div>

              <Link
                href={`/idstn/${encodeURIComponent(rec.dpn_id)}`}
                className="w-full inline-flex items-center justify-center gap-1.5 text-xs bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 py-2 rounded-lg transition-colors border border-purple-500/30 font-semibold"
              >
                <Search className="h-3.5 w-3.5" />
                <span>Track IDSTN Journey</span>
              </Link>
            </div>
          ))
        )}
      </div>

      {/* =======================================================================
          DESKTOP TABLE VIEW (>= md)
         ======================================================================= */}
      <div className="hidden md:block glass-card rounded-2xl overflow-hidden border border-white/[0.08] shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/70 border-b border-white/[0.08] text-slate-400 uppercase font-mono text-[11px]">
                <th className="py-3.5 px-4 font-semibold">IDSTN Number</th>
                <th className="py-3.5 px-4 font-semibold text-center">Direction</th>
                <th className="py-3.5 px-4 font-semibold">Partner Store</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold">Created Date</th>
                <th className="py-3.5 px-4 font-semibold">HO Sync Date</th>
                <th className="py-3.5 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No matching transfers found for {branch_id}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.dpn_id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/idstn/${encodeURIComponent(rec.dpn_id)}`}
                          className="font-mono text-purple-300 font-semibold hover:text-purple-200 hover:underline transition-colors"
                        >
                          {rec.dpn_id}
                        </Link>
                        <button
                          onClick={() => handleCopy(rec.dpn_id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-white transition-opacity p-0.5"
                          title="Copy IDSTN"
                        >
                          {copiedId === rec.dpn_id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={cn(
                          "px-2.5 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1",
                          rec.direction === "OUTGOING"
                            ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        )}
                      >
                        {rec.direction === "OUTGOING" ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        {rec.direction}
                      </span>
                    </td>

                    <td className="py-3.5 px-4">
                      <Link
                        href={`/shop/${rec.direction === "OUTGOING" ? rec.dpn_dest_branchid : rec.dpn_src_branchid}?org=${org}`}
                        className="font-mono font-semibold text-slate-300 hover:text-white transition-colors"
                      >
                        {rec.direction === "OUTGOING" ? rec.dpn_dest_branchid : rec.dpn_src_branchid}
                      </Link>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px] font-bold border whitespace-nowrap",
                          getStatusColor(rec.dpn_status)
                        )}
                      >
                        {rec.status_text.toUpperCase()}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-300 font-mono">
                      {formatDate(rec.rec_date)}
                    </td>

                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {formatDate(rec.sync_date)}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/idstn/${encodeURIComponent(rec.dpn_id)}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/15 hover:bg-purple-600/25 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all hover:shadow-sm hover:shadow-purple-500/20"
                      >
                        <Search className="h-3.5 w-3.5" />
                        <span>Track</span>
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
