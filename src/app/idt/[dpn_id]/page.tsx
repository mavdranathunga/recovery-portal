"use client";

import { useEffect, useState, use } from "react";
import { ArrowRight, CheckCircle2, Clock, MapPin, Database, RefreshCw, AlertCircle, HardDrive, Store } from "lucide-react";
import { formatDate, getStatusColor, cn } from "@/lib/utils";
import Link from "next/link";

import { useOrg } from "@/lib/OrgContext";

interface IdtRecord {
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

interface IdtResponse {
  dpn_id: string;
  ho: IdtRecord | null;
  source: NodeData;
  dest: NodeData;
  error?: string;
  details?: string;
}

export default function IdtTrackerPage({ params }: { params: Promise<{ dpn_id: string }> }) {
  const unwrappedParams = use(params);
  const dpn_id = unwrappedParams.dpn_id;
  const { org } = useOrg();

  const [data, setData] = useState<IdtResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdtData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/idt/${dpn_id}?org=${org}`);

      if (!res.ok) {
        throw new Error("Failed to fetch IDT data. Status: " + res.status);
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
    fetchIdtData();
  }, [dpn_id, org]);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <RefreshCw className="h-10 w-10 text-blue-500 animate-spin mb-4" />
        <h2 className="text-xl font-medium text-slate-300">Tracking IDT across databases...</h2>
        <p className="text-slate-500 text-sm mt-2">Connecting to Head Office & Outlet DBs</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Search Failed</h2>
        <p className="text-red-400 max-w-lg text-center">{error}</p>
        <Link href="/" className="mt-8 px-6 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors">
          Return Home
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { ho, source, dest } = data;

  const isValidSource = source?.record && !source.record.error;
  const isValidHo = ho && !ho.error;
  const isValidDest = dest?.record && !dest.record.error;

  const currentStatus = ho?.dpn_status || (source?.record && !source.record.error ? source.record.dpn_status : null);

  // If HO has 'R' or 'P', OR if the record is physically found in the destination outlet,
  // we know definitively that the IDT was successfully synced/delivered!
  const isDefinitivelyReceived = (isValidHo && (currentStatus === "R" || currentStatus === "P")) || isValidDest;
  const isComplete = isDefinitivelyReceived || (isValidSource && isValidHo && isValidDest);

  let bannerConfig = {
    colorClass: "bg-yellow-500/10 border-yellow-500/20 text-yellow-100",
    icon: <Clock className="h-6 w-6 text-yellow-400 flex-shrink-0" />,
    title: "Pending Download to Destination Outlet",
    desc: `The IDT has reached HO but hasn't synced to destination shop ${dest?.branch_id || 'yet'}.`
  };

  if (isComplete) {
    bannerConfig = {
      colorClass: "bg-green-500/10 border-green-500/20 text-green-100",
      icon: <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0" />,
      title: "Fully Synchronized",
      desc: "The IDT has successfully reached all databases in the journey."
    };
  } else if (!isValidHo) {
    if (currentStatus === "E") {
      bannerConfig = {
        colorClass: "bg-slate-500/10 border-slate-500/20 text-slate-300",
        icon: <Clock className="h-6 w-6 text-slate-400 flex-shrink-0" />,
        title: "Uncommitted at Source Outlet",
        desc: "The IDT has only been 'Entered' (E). It must be committed before it will sync to Head Office."
      };
    } else {
      bannerConfig = {
        colorClass: "bg-red-500/10 border-red-500/20 text-red-100",
        icon: <AlertCircle className="h-6 w-6 text-red-400 flex-shrink-0" />,
        title: "Pending Upload to Head Office",
        desc: "The IDT exists at the source outlet but has not yet been synced by the HO cronjob."
      };
    }
  } else if (currentStatus === "C") {
    bannerConfig = {
      colorClass: "bg-slate-800 border-slate-700 text-slate-300",
      icon: <AlertCircle className="h-6 w-6 text-slate-500 flex-shrink-0" />,
      title: "IDT Cancelled",
      desc: "This IDT has been cancelled and will not progress further."
    };
  }

  const bestRecord = ho || (source?.record && !source.record.error ? source.record : null) || (dest?.record && !dest.record.error ? dest.record : null);

  return (
    <div className="animate-in fade-in duration-500">

      {/* Header Container */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            IDT Tracker
            <span className="text-blue-400 px-3 py-1 bg-blue-500/10 rounded-md text-sm font-mono border border-blue-500/20">
              {dpn_id}
            </span>
          </h1>
          <p className="text-slate-400 mt-2">
            Real-time synchronization status across network databases.
          </p>
        </div>
        <button
          onClick={fetchIdtData}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm border border-slate-700"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh Status
        </button>
      </div>

      {/* Progress summary banner */}
      <div className={cn("mb-12 p-4 rounded-xl border flex items-center gap-4", bannerConfig.colorClass)}>
        {bannerConfig.icon}
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{bannerConfig.title}</h3>
          <p className="text-sm opacity-80">{bannerConfig.desc}</p>
        </div>
      </div>

      {/* Global IDT Properties */}
      {bestRecord && (
        <div className="mb-12 glass-card p-6 border border-slate-700/50">
          <h3 className="text-lg font-semibold text-slate-200 mb-4 pb-3 border-b border-slate-800">IDT Details</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Created</p>
              <p className="text-slate-200 font-medium">{formatDate(bestRecord.rec_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Updated</p>
              <p className="text-slate-200 font-medium">{formatDate(bestRecord.lupd_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1">Committed</p>
              <p className="text-slate-200 font-medium">{formatDate(bestRecord.dpn_commit_date)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-1 text-blue-400">Sync</p>
              <p className="text-blue-100 font-semibold">{formatDate(bestRecord.sync_date)}</p>
            </div>

          </div>
        </div>
      )}

      {/* Timeline Visualization */}
      <div className="relative mb-16">
        <div className="hidden md:block timeline-line" />

        <div className="grid md:grid-cols-3 gap-8 relative z-10">

          <TimelineNode
            title="Source Outlet"
            nodeData={source}
            isHo={false}
            icon={<MapPin className="h-5 w-5" />}
          />

          <TimelineNode
            title="Head Office"
            nodeData={{ record: ho, branch_id: "HO", ip: process.env.NEXT_PUBLIC_HO_IP || "Central" }}
            isHo={true}
            icon={<Database className="h-5 w-5" />}
          />

          <TimelineNode
            title="Destination Outlet"
            nodeData={dest}
            isHo={false}
            icon={<MapPin className="h-5 w-5" />}
          />

        </div>
      </div>

    </div>
  );
}

function TimelineNode({ title, nodeData, isHo, icon }: { title: string, nodeData: NodeData, isHo: boolean, icon: React.ReactNode }) {
  const { record, branch_id, branch_name, ip } = nodeData || {};
  const isFound = !!record && !record.error;
  const isError = !!record?.error;

  return (
    <div className="glass-card flex flex-col items-center p-6 relative">

      {/* Node status icon */}
      <div className={cn(
        "rounded-full p-3 mb-4 ring-8 ring-slate-900",
        isError ? "bg-red-500 text-white" :
          isFound ? "bg-blue-600 text-white" : "bg-slate-700 text-slate-400"
      )}>
        {icon}
      </div>

      <div className="flex flex-col items-center text-center">
        {!isHo ? (
          branch_name ? (
            <p className="text-emerald-400 text-sm font-bold uppercase tracking-widest mb-1 underline decoration-emerald-500/30 underline-offset-4">
              {branch_name}
            </p>
          ) : (
            <p className="text-slate-500 text-xs font-semibold uppercase tracking-widest mb-1">
              Loading name...
            </p>
          )
        ) : (
          <div className="mb-1 h-[20px]" /> /* Vertical spacer to align HO with Shops */
        )}
        <h3 className="text-xl font-black text-white mb-2 leading-tight">
          {isHo ? "Head Office" : title}
        </h3>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <span className="text-sm font-bold bg-slate-800 px-3 py-1 rounded text-slate-100 flex items-center gap-1.5 border border-slate-700 shadow-sm">
          <Store className="h-3.5 w-3.5 text-blue-400" /> {branch_id || "MISSING"}
        </span>
        <span className="text-md text-slate-300 font-mono flex items-center gap-1 bg-slate-900/50 px-2 py-1 rounded border border-slate-800/50">
          <HardDrive className="h-3 w-3" /> {ip || "No IP"}
        </span>
      </div>

      <div className="w-full space-y-3">
        {isError && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 text-center">
            {record.error}
          </div>
        )}

        {!isFound && !isError && (
          <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg text-center flex flex-col items-center justify-center min-h-[120px]">
            <Clock className="h-6 w-6 text-slate-500 mb-2" />
            <p className="text-slate-400 font-medium tracking-wide">RECORD NOT FOUND</p>
            <p className="text-xs text-slate-500 mt-1">Awaiting sync cycle</p>
          </div>
        )}

        {isFound && !isError && (
          <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 space-y-4">

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Status</span>
              <span className={cn(
                "px-2.5 py-1 rounded text-xs font-bold border",
                getStatusColor(record.dpn_status)
              )}>
                {record.status_text.toUpperCase()}
              </span>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}

function DateRow({ label, dateStr, highlight }: { label: string, dateStr?: string, highlight?: boolean }) {
  if (!dateStr) return null;
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-500">{label}:</span>
      <span className={cn("font-medium", highlight ? "text-blue-300 font-semibold" : "text-slate-300")}>
        {formatDate(dateStr)}
      </span>
    </div>
  );
}
