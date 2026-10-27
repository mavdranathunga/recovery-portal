"use client";

import { useEffect, useState, use } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  MapPin,
  Database,
  RefreshCw,
  AlertCircle,
  HardDrive,
  Store,
  ChevronLeft,
  Copy,
  Check,
  ArrowUpRight,
  ShieldCheck,
  Calendar,
  Layers,
  Search,
} from "lucide-react";
import { formatDate, getStatusColor, cn } from "@/lib/utils";
import Link from "next/link";
import { useOrg } from "@/lib/OrgContext";

interface IdstnRecord {
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
  error?: string;
}

interface NodeData {
  branch_id?: string;
  branch_name?: string;
  ip?: string;
  record?: any;
}

interface IdstnResponse {
  dpn_id: string;
  ho: IdstnRecord | null;
  source: NodeData;
  dest: NodeData;
  error?: string;
  details?: string;
}

export default function IdstnTrackerPage({ params }: { params: Promise<{ dpn_id: string }> }) {
  const unwrappedParams = use(params);
  const dpn_id = unwrappedParams.dpn_id;
  const { org } = useOrg();

  const [data, setData] = useState<IdstnResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const fetchIdstnData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/idstn/${dpn_id}?org=${org}`);
      if (!res.ok) {
        throw new Error("Failed to fetch IDSTN data. Status: " + res.status);
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
    fetchIdstnData();
  }, [dpn_id, org]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] animate-in fade-in duration-300">
        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4 shadow-lg shadow-blue-500/10">
          <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Tracking IDSTN Lifecycle...</h2>
        <p className="text-slate-400 text-xs sm:text-sm mt-1.5 font-mono">
          Probing Head Office, Source Store, and Destination databases
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
        <h2 className="text-2xl font-bold text-white mb-2">IDSTN Search Failed</h2>
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

  const { ho, source, dest } = data;

  const isValidSource = source?.record && !source.record.error;
  const isValidHo = ho && !ho.error;
  const isValidDest = dest?.record && !dest.record.error;

  const currentStatus =
    ho?.dpn_status || (source?.record && !source.record.error ? source.record.dpn_status : null);

  const isDefinitivelyReceived =
    (isValidHo && (currentStatus === "R" || currentStatus === "P")) || isValidDest;
  const isComplete = isDefinitivelyReceived || (isValidSource && isValidHo && isValidDest);

  let bannerConfig = {
    colorClass: "bg-amber-500/10 border-amber-500/30 text-amber-200",
    iconBg: "bg-amber-500/20 text-amber-400",
    icon: <Clock className="h-5 w-5 text-amber-400" />,
    badge: "In Transit",
    title: "Pending Download to Destination Outlet",
    desc: `Payload has successfully reached Head Office but has not yet synchronized to destination shop ${dest?.branch_id || ""
      }.`,
  };

  if (isComplete) {
    bannerConfig = {
      colorClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-200",
      iconBg: "bg-emerald-500/20 text-emerald-400",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />,
      badge: "Completed",
      title: "Fully Synchronized & Delivered",
      desc: "This transfer payload has successfully traversed the network and completed ingestion across all databases.",
    };
  } else if (!isValidHo) {
    if (currentStatus === "E") {
      bannerConfig = {
        colorClass: "bg-slate-800/80 border-slate-700 text-slate-300",
        iconBg: "bg-slate-700 text-slate-300",
        icon: <Clock className="h-5 w-5 text-slate-400" />,
        badge: "Draft",
        title: "Uncommitted at Source Outlet",
        desc: "The IDSTN has only been 'Entered' (Status E). It must be finalized/committed at the source till before syncing to Head Office.",
      };
    } else {
      bannerConfig = {
        colorClass: "bg-blue-500/10 border-blue-500/30 text-blue-200",
        iconBg: "bg-blue-500/20 text-blue-400",
        icon: <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />,
        badge: "Queued",
        title: "Pending Upload to Head Office",
        desc: "The transfer is committed locally at the source branch and is awaiting the next background Head Office sync cron.",
      };
    }
  } else if (currentStatus === "C") {
    bannerConfig = {
      colorClass: "bg-rose-500/10 border-rose-500/30 text-rose-200",
      iconBg: "bg-rose-500/20 text-rose-400",
      icon: <AlertCircle className="h-5 w-5 text-rose-400" />,
      badge: "Cancelled",
      title: "Transfer Cancelled",
      desc: "This transfer payload was marked as Cancelled (Status C) and will not progress further.",
    };
  }

  const bestRecord =
    ho ||
    (source?.record && !source.record.error ? source.record : null) ||
    (dest?.record && !dest.record.error ? dest.record : null);

  return (
    <div className="animate-in fade-in duration-500 pb-16 space-y-6">
      {/* =======================================================================
          TOP HEADER: Breadcrumb, Payload Title & Quick Actions
         ======================================================================= */}
      <div className="glass-card p-5 sm:p-7 rounded-2xl border border-white/[0.08] relative overflow-hidden backdrop-blur-xl">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />

        <div className="flex items-center justify-between gap-3 mb-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors group"
          >
            <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span>Command Center</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchIdstnData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-white/[0.08] transition-colors"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin text-blue-400")} />
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Track IDSTN Journey
              </span>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 font-mono font-bold text-sm sm:text-base shadow-sm">
                <span>{dpn_id}</span>
                <button
                  onClick={() => handleCopy(dpn_id)}
                  className="text-slate-400 hover:text-white transition-colors p-0.5"
                  title="Copy IDSTN number"
                >
                  {copiedId ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm">
              Real-time multi-database replication audit across retail endpoints and central databases.
            </p>
          </div>
        </div>
      </div>

      {/* =======================================================================
          PROGRESS SUMMARY BANNER
         ======================================================================= */}
      <div
        className={cn(
          "p-4 sm:p-5 rounded-2xl border flex items-start sm:items-center gap-4 transition-all shadow-md",
          bannerConfig.colorClass
        )}
      >
        <div className={cn("p-2.5 rounded-xl shrink-0 shadow-inner", bannerConfig.iconBg)}>
          {bannerConfig.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-bold text-base sm:text-lg text-white tracking-tight">
              {bannerConfig.title}
            </h3>
            <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded-full bg-black/30 border border-white/10">
              {bannerConfig.badge}
            </span>
          </div>
          <p className="text-xs sm:text-sm opacity-90 leading-relaxed">{bannerConfig.desc}</p>
        </div>
      </div>

      {/* =======================================================================
          GLOBAL IDSTN TIMESTAMPS METRICS STRIP
         ======================================================================= */}
      {bestRecord && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Created Timestamp
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white font-mono block">
              {formatDate(bestRecord.rec_date)}
            </span>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Committed Timestamp
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white font-mono block">
              {formatDate(bestRecord.dpn_commit_date)}
            </span>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] font-mono text-blue-400 uppercase tracking-wider block mb-1">
              HO Sync Timestamp
            </span>
            <span className="text-xs sm:text-sm font-bold text-blue-300 font-mono block">
              {formatDate(bestRecord.sync_date)}
            </span>
          </div>

          <div className="glass-card p-4 rounded-xl border border-white/[0.06]">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
              Last Updated
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-300 font-mono block">
              {formatDate(bestRecord.lupd_date)}
            </span>
          </div>
        </div>
      )}

      {/* =======================================================================
          REPLICATION PIPELINE (3-STAGE STEPPER)
         ======================================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Replication Pipeline Stepper
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">3-Node Topology</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* STAGE 1: SOURCE OUTLET */}
          <div className="glass-card p-6 rounded-2xl border border-white/[0.08] flex flex-col justify-between relative overflow-hidden shadow-sm">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500 opacity-70" />

            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-3 rounded-xl border",
                      isValidSource
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/30"
                        : "bg-slate-800 text-slate-500 border-white/[0.06]"
                    )}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">Stage 1</span>
                    <h4 className="text-base font-bold text-white">Source Outlet</h4>
                  </div>
                </div>

                <span
                  className={cn(
                    "text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border",
                    isValidSource
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border-white/[0.06]"
                  )}
                >
                  {isValidSource ? "Record Found" : "Not Found"}
                </span>
              </div>

              {/* Outlet Info */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-slate-400">Branch:</span>
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <Store className="h-3.5 w-3.5 text-blue-400" />
                    <span>{source?.branch_id || "Unknown"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-slate-400">Host IP:</span>
                  <span className="font-mono text-slate-300">{source?.ip || "No IP"}</span>
                </div>

                {source?.branch_name && (
                  <p className="text-lg text-slate-300 px-1 mt-2">{source.branch_name}</p>
                )}
              </div>

              {/* Status Pill */}
              {source?.record && !source.record.error && (
                <div className="p-3 bg-black/40 rounded-xl border border-white/[0.04] mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">Store Status:</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-bold border",
                        getStatusColor(source.record.dpn_status)
                      )}
                    >
                      {source.record.status_text?.toUpperCase() || source.record.dpn_status}
                    </span>
                  </div>
                </div>
              )}

              {source?.record?.error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs mb-4">
                  {source.record.error}
                </div>
              )}
            </div>

            {source?.branch_id && (
              <Link
                href={`/shop/${source.branch_id}?org=${org}`}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/[0.06] transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                <span>View Source Ledger</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {/* STAGE 2: HEAD OFFICE CENTRAL DB */}
          <div className="glass-card p-6 rounded-2xl border border-white/[0.08] flex flex-col justify-between relative overflow-hidden shadow-sm">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-70" />

            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-3 rounded-xl border",
                      isValidHo
                        ? "bg-purple-500/10 text-purple-400 border-purple-500/30"
                        : "bg-slate-800 text-slate-500 border-white/[0.06]"
                    )}
                  >
                    <Database className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">Stage 2</span>
                    <h4 className="text-base font-bold text-white">Head Office DB</h4>
                  </div>
                </div>

                <span
                  className={cn(
                    "text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border",
                    isValidHo
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-800 text-slate-400 border-white/[0.06]"
                  )}
                >
                  {isValidHo ? "Replicated" : "Awaiting Sync"}
                </span>
              </div>

              {/* Central DB Info */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-slate-400">Node:</span>
                  <span className="font-semibold text-white">Central Head Office</span>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-slate-400">Sync Date:</span>
                  <span className="font-mono text-purple-300">
                    {ho?.sync_date ? formatDate(ho.sync_date) : "Pending Ingestion"}
                  </span>
                </div>
                <p className="text-lg text-slate-300 px-1 mt-2">Head Office</p>
              </div>

              {/* Status Pill */}
              {ho && !ho.error ? (
                <div className="p-3 bg-black/40 rounded-xl border border-white/[0.04] mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">HO Status:</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-bold border",
                        getStatusColor(ho.dpn_status)
                      )}
                    >
                      {ho.status_text?.toUpperCase() || ho.dpn_status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-900/40 rounded-xl border border-white/[0.04] text-center text-xs text-slate-500 mb-4">
                  No record in Head Office database yet.
                </div>
              )}
            </div>

            <div className="w-full py-2 px-3 rounded-xl bg-slate-950/60 text-slate-500 text-xs font-mono text-center border border-white/[0.04] mt-2">
              Central Oracle Sync Engine
            </div>
          </div>

          {/* STAGE 3: DESTINATION OUTLET */}
          <div className="glass-card p-6 rounded-2xl border border-white/[0.08] flex flex-col justify-between relative overflow-hidden shadow-sm">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-purple-500 to-emerald-500 opacity-70" />

            <div>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-3 rounded-xl border",
                      isValidDest
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-slate-800 text-slate-500 border-white/[0.06]"
                    )}
                  >
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-500 block">Stage 3</span>
                    <h4 className="text-base font-bold text-white">Destination Outlet</h4>
                  </div>
                </div>

                <span
                  className={cn(
                    "text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border",
                    isValidDest
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  )}
                >
                  {isValidDest ? "Delivered" : "In Flight"}
                </span>
              </div>

              {/* Destination Info */}
              <div className="space-y-2 mb-5">
                <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-slate-400">Branch:</span>
                  <div className="flex items-center gap-1.5 font-semibold text-white">
                    <Store className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{dest?.branch_id || "Unknown"}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs bg-slate-950/60 p-2.5 rounded-xl border border-white/[0.04]">
                  <span className="text-slate-400">Host IP:</span>
                  <span className="font-mono text-slate-300">{dest?.ip || "No IP"}</span>
                </div>

                {dest?.branch_name && (
                  <p className="text-lg text-slate-300 px-1 mt-2">{dest.branch_name}</p>
                )}
              </div>

              {/* Status Pill */}
              {dest?.record && !dest.record.error ? (
                <div className="p-3 bg-black/40 rounded-xl border border-white/[0.04] mb-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-mono">Store Status:</span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded text-[11px] font-bold border",
                        getStatusColor(dest.record.dpn_status)
                      )}
                    >
                      {dest.record.status_text?.toUpperCase() || dest.record.dpn_status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-900/40 rounded-xl border border-white/[0.04] text-center text-xs text-slate-500 mb-4">
                  Awaiting local download sync cycle.
                </div>
              )}

              {dest?.record?.error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs mb-4">
                  {dest.record.error}
                </div>
              )}
            </div>

            {dest?.branch_id && (
              <Link
                href={`/shop/${dest.branch_id}?org=${org}`}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-white/[0.06] transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                <span>View Target Ledger</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
