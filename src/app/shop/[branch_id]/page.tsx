"use client";

import { useEffect, useState, use } from "react";
import { Store, RefreshCw, AlertCircle, ArrowRight, Search, Clock, Activity } from "lucide-react";
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
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-10 w-10 text-purple-500 animate-spin mb-4" />
        <h2 className="text-xl font-medium text-slate-300">Loading Shop Data...</h2>
        <p className="text-slate-500 text-sm mt-2">Querying Head Office DB for {branch_id}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Monitor Failed</h2>
        <p className="text-red-400 max-w-lg text-center">{error}</p>
        <Link href="/" className="mt-8 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
          Return Home
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const filteredRecords = data.records.filter(r => {
    const matchesDirection = filter === "ALL" || r.direction === filter;
    const matchesIdt = r.dpn_id.toUpperCase().includes(idtSearch.toUpperCase());
    return matchesDirection && matchesIdt;
  });

  return (
    <div className="animate-in fade-in duration-500">

      <div className="flex flex-col lg:flex-row lg:items-end justify-between mb-8 gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-white uppercase tracking-tight">
              {data.branch_name}
            </h1>
            <span className="text-purple-400 px-2.5 py-0.5 sm:px-3 sm:py-1 bg-purple-500/10 rounded border border-purple-500/20 text-base sm:text-xl font-mono font-bold tracking-widest">
              {data.branch_id}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Live Data Source Badge */}
            {data.dataSource === "OUTLET" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live from Outlet DB {data.branch_ip ? `(${data.branch_ip})` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-400">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                Fallback Data from Head Office
              </span>
            )}

            {data?.last_sync_time && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800/80 border border-white/10 text-slate-300">
                <Clock className="h-3 w-3 text-slate-400" /> Last HO sync: {formatDate(data.last_sync_time)}
              </span>
            )}
          </div>

          {/* Unreachable Outlet Notice Banner */}
          {data.connectionWarning && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2 animate-in slide-in-from-top-1">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>{data.connectionWarning}</span>
            </div>
          )}
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Filter by IDT #..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              value={idtSearch}
              onChange={(e) => setIdtSearch(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-800/50 rounded-lg border border-slate-700 p-1">
            <FilterButton active={filter === "ALL"} onClick={() => setFilter("ALL")} label="All" />
            <FilterButton active={filter === "OUTGOING"} onClick={() => setFilter("OUTGOING")} label="Outgoing" />
            <FilterButton active={filter === "INCOMING"} onClick={() => setFilter("INCOMING")} label="Incoming" />
          </div>
          <button
            onClick={fetchShopData}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm border border-slate-700 whitespace-nowrap"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Mobile Card View (shown below md breakpoint) */}
      <div className="block md:hidden space-y-3 mb-6">
        {filteredRecords.length === 0 ? (
          <div className="glass-card p-8 text-center text-slate-500 text-sm">
            No records found for {branch_id}
          </div>
        ) : (
          filteredRecords.map((rec) => (
            <div key={rec.dpn_id} className="glass-card p-4 space-y-3 border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-mono text-blue-400 font-semibold text-base">{rec.dpn_id}</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold border",
                  rec.direction === "OUTGOING" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                )}>
                  {rec.direction}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="text-slate-400">Target Outlet:</span>
                <span className="font-mono font-medium text-slate-200">
                  {rec.direction === "OUTGOING" ? rec.dpn_dest_branchid : rec.dpn_src_branchid}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Status:</span>
                <span className={cn(
                  "px-2 py-0.5 rounded text-xs font-bold border",
                  getStatusColor(rec.dpn_status)
                )}>
                  {rec.status_text.toUpperCase()}
                </span>
              </div>

              {rec.rec_date && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Created:</span>
                  <span>{formatDate(rec.rec_date)}</span>
                </div>
              )}

              {rec.sync_date && (
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>Synced to HO:</span>
                  <span>{formatDate(rec.sync_date)}</span>
                </div>
              )}

              <div className="pt-2 border-t border-white/5 flex justify-end">
                <Link
                  href={`/idt/${encodeURIComponent(rec.dpn_id)}`}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-xs bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 px-3 py-2 rounded-lg transition-colors border border-blue-500/30 font-medium"
                >
                  <Search className="h-3.5 w-3.5" /> Track IDT Lifecycle
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden below md breakpoint) */}
      <div className="hidden md:block glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-700">
                <th className="p-4 font-semibold text-slate-300">IDT Number</th>
                <th className="p-4 font-semibold text-slate-300 text-center">Direction</th>
                <th className="p-4 font-semibold text-slate-300">Target</th>
                <th className="p-4 font-semibold text-slate-300">Status</th>
                <th className="p-4 font-semibold text-slate-300">Created</th>
                <th className="p-4 font-semibold text-slate-300">Synced to HO</th>
                <th className="p-4 font-semibold text-slate-300 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No records found for {branch_id}
                  </td>
                </tr>
              ) : (
                filteredRecords.map((rec) => (
                  <tr key={rec.dpn_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-mono text-blue-400 font-medium">{rec.dpn_id}</td>
                    <td className="p-4 text-center">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold border",
                        rec.direction === "OUTGOING" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      )}>
                        {rec.direction}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-slate-300">
                      {rec.direction === "OUTGOING" ? rec.dpn_dest_branchid : rec.dpn_src_branchid}
                    </td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-1 rounded text-xs font-bold border whitespace-nowrap",
                        getStatusColor(rec.dpn_status)
                      )}>
                        {rec.status_text.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-400">{formatDate(rec.rec_date)}</td>
                    <td className="p-4 text-sm text-slate-400">{formatDate(rec.sync_date)}</td>
                    <td className="p-4 text-right">
                      <Link
                        href={`/idt/${encodeURIComponent(rec.dpn_id)}`}
                        className="inline-flex items-center gap-1.5 text-sm bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-1.5 rounded-lg transition-colors border border-blue-500/20"
                      >
                        <Search className="h-3.5 w-3.5" /> Track
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

function FilterButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 text-sm rounded-md transition-colors font-medium",
        active ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
      )}
    >
      {label}
    </button>
  );
}
