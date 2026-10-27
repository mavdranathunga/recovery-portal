"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import {
  Terminal,
  ServerCrash,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Search,
  ChevronLeft,
  FileWarning,
  Wifi,
  WifiOff,
  Signal,
  Copy,
  Check,
  Clock,
  ShieldAlert,
  X,
  Activity,
  Layers,
  ArrowRight,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useOrg } from "@/lib/OrgContext";

interface Branch {
  id: string;
  name: string;
  ip: string;
}

function RecoveryPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { org } = useOrg();

  // Branch data
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  // Selected branch recovery state
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [statusOutput, setStatusOutput] = useState<{ output: string; error_output: string } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [execLoading, setExecLoading] = useState(false);
  const [execResult, setExecResult] = useState<{ output: string; error_output: string; success: boolean } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // Unsynced outlets state
  const [unsyncedLoading, setUnsyncedLoading] = useState(false);
  const [unsyncedBranches, setUnsyncedBranches] = useState<any[]>([]);
  const [showUnsynced, setShowUnsynced] = useState(false);
  const [unsyncedHours, setUnsyncedHours] = useState(3);
  const [unsyncedSearch, setUnsyncedSearch] = useState("");
  const [unsyncedPingFilter, setUnsyncedPingFilter] = useState<"all" | "online" | "offline">("all");

  // Unprocessed files state
  const [unprocessedLoading, setUnprocessedLoading] = useState(false);
  const [unprocessedFiles, setUnprocessedFiles] = useState<any[]>([]);
  const [showUnprocessed, setShowUnprocessed] = useState(false);
  const [unprocessedMinutes, setUnprocessedMinutes] = useState(5);
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});

  // Navigation tracking
  const [returnTo, setReturnTo] = useState<null | "unsynced" | "unprocessed">(null);

  // Per-branch ping state
  const [pingStates, setPingStates] = useState<Record<string, "loading" | "up" | "down" | "unknown">>({});

  // Copy-to-clipboard state
  const [copiedIp, setCopiedIp] = useState<string | null>(null);
  const [copiedTerminal, setCopiedTerminal] = useState(false);

  // Auto-scroll ref for streaming terminal output
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (execResult?.output || execResult?.error_output) {
      terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [execResult?.output, execResult?.error_output]);

  // Load branch list
  useEffect(() => {
    setLoading(true);
    fetch(`/api/branches?org=${org}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.branches) {
          setBranches(data.branches);
          setFilteredBranches(data.branches);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [org]);

  // Auto-select branch from URL query param (e.g., from middle-click or direct link)
  useEffect(() => {
    if (branches.length === 0) return;
    const branchParam = searchParams.get("branch");
    if (branchParam && !selectedBranch) {
      const found = branches.find((b) => b.id === branchParam);
      if (found) {
        handleSelectBranch(found);
        handleCheckStatus(found);
      }
    }
  }, [branches, searchParams]);

  // Filter branches in sidebar
  useEffect(() => {
    const q = search.toLowerCase().trim();
    if (!q) {
      setFilteredBranches(branches);
    } else {
      setFilteredBranches(
        branches.filter(
          (b) => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q) || b.ip.includes(q)
        )
      );
    }
  }, [search, branches]);

  const handleCopy = (text: string, type: "ip" | "terminal", id?: string) => {
    navigator.clipboard.writeText(text);
    if (type === "ip") {
      setCopiedIp(id || text);
      setTimeout(() => setCopiedIp(null), 2000);
    } else {
      setCopiedTerminal(true);
      setTimeout(() => setCopiedTerminal(false), 2000);
    }
  };

  const handleSelectBranch = (b: Branch) => {
    setSelectedBranch(b);
    setStatusOutput(null);
    setStatusError(null);
    setExecResult(null);
    setShowConfirm(false);
    setShowUnsynced(false);
    setShowUnprocessed(false);
    setReturnTo(null);
    handlePing(b.id);
  };

  const handleCheckStatus = async (branchOverride?: Branch, preserveExecResult = false) => {
    const targetBranch = branchOverride || selectedBranch;
    if (!targetBranch) return;

    if (branchOverride) {
      if (showUnsynced) setReturnTo("unsynced");
      else if (showUnprocessed) setReturnTo("unprocessed");
      setSelectedBranch(branchOverride);
      setShowUnsynced(false);
      setShowUnprocessed(false);
      handlePing(branchOverride.id);
    }

    setStatusLoading(true);
    setStatusError(null);
    setStatusOutput(null);
    if (!preserveExecResult) {
      setExecResult(null);
    }
    setShowConfirm(false);

    try {
      const res = await fetch(`/api/recovery/${targetBranch.id}/status?org=${org}`);
      const data = await res.json();
      if (data.error) {
        setStatusError(data.error + (data.details ? `: ${data.details}` : ""));
      } else {
        setStatusOutput({ output: data.output, error_output: data.error_output });
      }
    } catch {
      setStatusError("Failed to check status. Network connection error.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleExecute = async () => {
    if (!selectedBranch) return;
    setExecLoading(true);
    setShowConfirm(false);
    setExecResult({ output: "", error_output: "", success: true });

    try {
      const res = await fetch(`/api/recovery/${selectedBranch.id}/execute?org=${org}`, { method: "POST" });

      if (!res.ok) {
        const data = await res.json();
        setExecResult((prev) => ({
          ...prev!,
          error_output: (prev?.error_output || "") + (data.error || "Execution failed") + " - " + (data.details || ""),
          success: false,
        }));
        setExecLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === "out") {
                setExecResult((prev) => ({ ...prev!, output: prev!.output + msg.data }));
              } else if (msg.type === "err") {
                setExecResult((prev) => ({ ...prev!, error_output: prev!.error_output + msg.data }));
              } else if (msg.type === "done") {
                handleCheckStatus(undefined, true);
              }
            } catch (e) {
              console.error("Stream parse error:", e);
            }
          }
        }
      }
    } catch {
      setExecResult((prev) => ({
        ...prev!,
        error_output: (prev?.error_output || "") + "Failed to execute recovery. Network error.",
        success: false,
      }));
    } finally {
      setExecLoading(false);
    }
  };

  const handleFetchUnsynced = async (hoursOverride?: number) => {
    const h = hoursOverride ?? unsyncedHours;
    setUnsyncedLoading(true);
    setShowUnsynced(true);
    setSelectedBranch(null);
    setShowUnprocessed(false);
    setReturnTo(null);
    try {
      const res = await fetch(`/api/sync/unsynced?hours=${h}&org=${org}`);
      const data = await res.json();
      if (data.unsynced) {
        setUnsyncedBranches(data.unsynced);
        data.unsynced.forEach((b: any) => handlePing(b.id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUnsyncedLoading(false);
    }
  };

  const handlePingAll = (list: any[]) => {
    list.forEach((b) => handlePing(b.id));
  };

  const handleFetchUnprocessed = async (minutesOverride?: number) => {
    const m = minutesOverride ?? unprocessedMinutes;
    setUnprocessedLoading(true);
    setShowUnprocessed(true);
    setSelectedBranch(null);
    setShowUnsynced(false);
    setReturnTo(null);
    try {
      const res = await fetch(`/api/sync/unprocessed?minutes=${m}&org=${org}`);
      const data = await res.json();
      if (data.unprocessed) {
        setUnprocessedFiles(data.unprocessed);
        const outlets = new Set<string>(
          data.unprocessed.map((f: any) => f.BRANCH_ID || f.branch_id || "Unknown")
        );
        const expanded: Record<string, boolean> = {};
        outlets.forEach((o) => {
          expanded[o] = true;
        });
        setExpandedOutlets(expanded);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUnprocessedLoading(false);
    }
  };

  const handlePromptRecovery = (branch: Branch) => {
    if (showUnsynced) setReturnTo("unsynced");
    else if (showUnprocessed) setReturnTo("unprocessed");
    setSelectedBranch(branch);
    setShowUnsynced(false);
    setShowUnprocessed(false);
    setStatusOutput(null);
    setStatusError(null);
    setExecResult(null);
    setShowConfirm(true);
    handlePing(branch.id);
  };

  const handleGoBack = () => {
    setSelectedBranch(null);
    setStatusOutput(null);
    setStatusError(null);
    setExecResult(null);
    setShowConfirm(false);
    if (returnTo === "unsynced") {
      setShowUnsynced(true);
      setShowUnprocessed(false);
    } else if (returnTo === "unprocessed") {
      setShowUnprocessed(true);
      setShowUnsynced(false);
    }
    setReturnTo(null);
  };

  const handlePing = async (branchId: string) => {
    setPingStates((prev) => ({ ...prev, [branchId]: "loading" }));
    try {
      const res = await fetch(`/api/ping/${branchId}?org=${org}`);
      const data = await res.json();
      if (data.error || !data.reachable) {
        setPingStates((prev) => ({ ...prev, [branchId]: "down" }));
      } else {
        setPingStates((prev) => ({ ...prev, [branchId]: "up" }));
      }
    } catch {
      setPingStates((prev) => ({ ...prev, [branchId]: "down" }));
    }
  };

  const unsyncedOnlineCount = unsyncedBranches.filter((b) => pingStates[b.id] === "up").length;
  const unsyncedOfflineCount = unsyncedBranches.filter((b) => pingStates[b.id] === "down").length;

  const filteredUnsynced = unsyncedBranches.filter((b) => {
    const q = unsyncedSearch.toLowerCase().trim();
    if (q) {
      const matches =
        (b.id && b.id.toLowerCase().includes(q)) ||
        (b.name && b.name.toLowerCase().includes(q)) ||
        (b.ip && b.ip.includes(q));
      if (!matches) return false;
    }

    const ping = pingStates[b.id];
    if (unsyncedPingFilter === "online") return ping === "up";
    if (unsyncedPingFilter === "offline") return ping === "down";
    return true;
  });

  return (
    <div className="flex flex-col md:flex-row gap-6 md:h-[calc(100vh-6rem)] md:min-h-[620px] pb-6 animate-in fade-in duration-500 items-stretch">
      {/* =========================================================================
          LEFT SIDEBAR: Outlets List & Quick Filter Controls
         ========================================================================= */}
      <div
        className={`w-full md:w-72 lg:w-80 md:shrink-0 flex-col glass-card overflow-hidden h-[480px] md:h-full ${selectedBranch || showUnsynced || showUnprocessed ? "hidden md:flex" : "flex"
          }`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500/20 to-red-600/10 border border-rose-500/30 flex items-center justify-center shadow-inner">
              <ServerCrash className="h-5 w-5 text-rose-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">Recovery</h2>
              <p className="text-[11px] text-slate-400 font-mono">Service & Queue Healing</p>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-slate-800 text-slate-400 border border-white/5">
            {branches.length}
          </span>
        </div>

        {/* Quick Filter Pills */}
        <div className="p-3 border-b border-white/[0.08] flex flex-col gap-2.5 bg-slate-950/20">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleFetchUnsynced()}
              disabled={unsyncedLoading}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-all border ${showUnsynced
                ? "bg-blue-600/20 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/10"
                : "bg-slate-900/70 text-slate-300 border-white/[0.06] hover:bg-slate-800 hover:text-white"
                }`}
            >
              {unsyncedLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
              ) : (
                <Activity className="h-3.5 w-3.5 text-blue-400" />
              )}
              <span>Unsynced</span>
              {unsyncedBranches.length > 0 && (
                <span className="ml-auto bg-blue-500/30 text-blue-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-blue-500/40">
                  {unsyncedBranches.length}
                </span>
              )}
            </button>

            <button
              onClick={() => handleFetchUnprocessed()}
              disabled={unprocessedLoading}
              className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-medium transition-all border ${showUnprocessed
                ? "bg-amber-600/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10"
                : "bg-slate-900/70 text-slate-300 border-white/[0.06] hover:bg-slate-800 hover:text-white"
                }`}
            >
              {unprocessedLoading ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-400" />
              ) : (
                <FileWarning className="h-3.5 w-3.5 text-amber-400" />
              )}
              <span>Unprocessed</span>
              {unprocessedFiles.length > 0 && (
                <span className="ml-auto bg-amber-500/30 text-amber-300 text-[10px] font-bold px-1.5 py-0.2 rounded-full border border-amber-500/40">
                  {unprocessedFiles.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search outlets (name, ID, IP)..."
              className="w-full bg-slate-900/90 border border-white/[0.08] rounded-lg pl-9 pr-8 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Outlet List Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-rose-400" />
              <span className="text-xs">Loading outlets...</span>
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">No matching branches found</div>
          ) : (
            filteredBranches.map((branch) => {
              const isSelected = selectedBranch?.id === branch.id;
              const ping = pingStates[branch.id];

              return (
                <div
                  key={branch.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSelectBranch(branch)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") handleSelectBranch(branch);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex items-center justify-between group border ${isSelected
                    ? "bg-rose-500/15 border-rose-500/40 text-white shadow-sm shadow-rose-500/10"
                    : "hover:bg-slate-800/60 border-transparent text-slate-300"
                    }`}
                >
                  <div className="min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-semibold text-xs ${isSelected ? "text-rose-200" : "text-white"}`}>
                        {branch.id}
                      </span>
                      {ping === "up" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                      {ping === "down" && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{branch.name}</div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePing(branch.id);
                      }}
                      disabled={ping === "loading"}
                      title={branch.ip ? `Ping ${branch.ip}` : "No IP configured"}
                      className={`p-1.5 rounded-lg transition-colors ${ping === "up"
                        ? "text-emerald-400 bg-emerald-500/10"
                        : ping === "down"
                          ? "text-red-400 bg-red-500/10"
                          : "text-slate-500 hover:text-slate-300 hover:bg-slate-700/50"
                        }`}
                    >
                      {ping === "loading" ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : ping === "up" ? (
                        <Wifi className="h-3 w-3" />
                      ) : ping === "down" ? (
                        <WifiOff className="h-3 w-3" />
                      ) : (
                        <Signal className="h-3 w-3" />
                      )}
                    </button>
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 ${isSelected ? "text-rose-400" : "text-slate-600"
                        }`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =========================================================================
          MAIN VIEW PANEL
         ========================================================================= */}
      <div
        className={`w-full flex-1 flex-col glass-card overflow-hidden h-auto md:h-full min-h-[480px] md:min-h-0 ${!selectedBranch && !showUnsynced && !showUnprocessed ? "hidden md:flex" : "flex"
          }`}
      >
        {/* =======================================================================
            STATE 1: EMPTY / HERO DISCOVERY
           ======================================================================= */}
        {!selectedBranch && !showUnsynced && !showUnprocessed ? (
          <div className="flex-1 overflow-y-auto p-6 sm:p-10 custom-scrollbar flex flex-col justify-between animate-in fade-in duration-300">
            {/* Hero Top */}
            <div className="max-w-3xl mx-auto w-full text-center py-6 sm:py-10">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-medium mb-6">
                <ServerCrash className="h-3.5 w-3.5 text-rose-400" />
                <span>Automated Outlet Recovery & Diagnostics</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
                Syncronization & Queue Management
              </h1>
              <p className="text-slate-400 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">
                Rapidly identify outlets with synchronization lag, inspect stuck file queues, and perform isolated
                Tomcat/Java recovery routines with real-time log streaming.
              </p>
            </div>

            {/* Two Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto w-full mb-8">
              {/* Card 1: Unsynced Outlets */}
              <div
                onClick={() => handleFetchUnsynced()}
                className="group relative bg-gradient-to-br from-blue-950/30 to-slate-900/60 border border-blue-500/20 hover:border-blue-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <Activity className="h-6 w-6 text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center justify-between">
                    <span>Unsynced Outlets</span>
                    <ArrowRight className="h-4 w-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Detect stores where sync transmissions have lapsed beyond threshold (default 3 hours). Includes
                    multi-outlet ping verification and one-click recovery.
                  </p>
                </div>
                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-medium text-blue-400">
                  <span>Threshold: {unsyncedHours}h</span>
                  <span className="flex items-center gap-1 group-hover:underline">
                    Scan Outlets <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>

              {/* Card 2: Unprocessed Files */}
              <div
                onClick={() => handleFetchUnprocessed()}
                className="group relative bg-gradient-to-br from-amber-950/30 to-slate-900/60 border border-amber-500/20 hover:border-amber-500/50 rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/10 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                    <FileWarning className="h-6 w-6 text-amber-400" />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 flex items-center justify-between">
                    <span>Unprocessed Queue</span>
                    <ArrowRight className="h-4 w-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Inspect files stranded in synchronization queues grouped by retail branch. View file timestamps,
                    parser errors, and affected transaction counts.
                  </p>
                </div>
                <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-medium text-amber-400">
                  <span>Threshold: {unprocessedMinutes}m</span>
                  <span className="flex items-center gap-1 group-hover:underline">
                    Inspect Queue <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </div>

            {/* Protocol Explanation Strip */}
            <div className="max-w-4xl mx-auto w-full bg-slate-950/40 border border-white/[0.06] rounded-2xl p-5 mb-4">
              <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <span>3-Step Automated Healing Protocol</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-400">
                <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <strong className="block text-white mb-1">1. Health Probe</strong>
                  Checks target outlet clock synchronization and scheduled atq jobs via SSH.
                </div>
                <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <strong className="block text-white mb-1">2. Process Purge</strong>
                  Safely terminates stale JVM instances and cleans accumulated Catalina work logs.
                </div>
                <div className="p-3 bg-white/[0.02] rounded-xl border border-white/[0.04]">
                  <strong className="block text-white mb-1">3. Daemon Restart</strong>
                  Reinitializes the Tomcat service daemon with live NDJSON log streaming.
                </div>
              </div>
            </div>
          </div>
        ) : showUnprocessed ? (
          /* =======================================================================
              STATE 2: UNPROCESSED FILES VIEW
             ======================================================================= */
          <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/[0.08] bg-slate-900/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowUnprocessed(false)}
                    className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors border border-white/[0.06]"
                    title="Back to Overview"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                      <FileWarning className="h-5 w-5 text-amber-400" />
                      <span>Unprocessed Sync Files</span>
                      {unprocessedFiles.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {unprocessedFiles.length} files
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">Files stuck in queue awaiting database ingestion</p>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleFetchUnprocessed()}
                    disabled={unprocessedLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-white/[0.06] transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${unprocessedLoading ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                  <button
                    onClick={() => {
                      const allExpanded = Object.values(expandedOutlets).every(Boolean);
                      const outlets = new Set<string>(
                        unprocessedFiles.map((f: any) => f.BRANCH_ID || f.branch_id || "Unknown")
                      );
                      const nextState: Record<string, boolean> = {};
                      outlets.forEach((o) => {
                        nextState[o] = !allExpanded;
                      });
                      setExpandedOutlets(nextState);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-xs font-medium text-slate-300 border border-white/[0.06] transition-colors"
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span>Toggle All</span>
                  </button>
                </div>
              </div>

              {/* Threshold Presets & Filter */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/[0.04]">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-400" />
                  Stuck longer than:
                </span>
                {[5, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => {
                      setUnprocessedMinutes(mins);
                      handleFetchUnprocessed(mins);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${unprocessedMinutes === mins
                      ? "bg-amber-500/25 text-amber-300 border border-amber-500/50"
                      : "bg-slate-900/80 text-slate-400 hover:text-white border border-white/[0.06]"
                      }`}
                  >
                    {mins}m
                  </button>
                ))}

                <div className="flex items-center gap-1 ml-auto">
                  <input
                    type="number"
                    min={1}
                    max={1440}
                    value={unprocessedMinutes}
                    onChange={(e) => setUnprocessedMinutes(Number(e.target.value))}
                    className="w-16 bg-slate-900 border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-amber-500/50"
                  />
                  <span className="text-xs text-slate-400 mr-2">mins</span>
                  <button
                    onClick={() => handleFetchUnprocessed()}
                    disabled={unprocessedLoading}
                    className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            {/* Files Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {unprocessedLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                  <RefreshCw className="h-8 w-8 text-amber-400 animate-spin" />
                  <span className="text-sm">Scanning sync queues...</span>
                </div>
              ) : unprocessedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-emerald-400 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-semibold text-white mb-1">Queue Clear</h3>
                    <p className="text-xs text-slate-400">
                      No files exceeding the {unprocessedMinutes} minute threshold.
                    </p>
                  </div>
                </div>
              ) : (
                (() => {
                  const grouped = unprocessedFiles.reduce((acc: Record<string, any[]>, file) => {
                    const key = file.BRANCH_ID || file.branch_id || "Unknown";
                    if (!acc[key]) acc[key] = [];
                    acc[key].push(file);
                    return acc;
                  }, {});

                  const outletKeys = Object.keys(grouped);

                  return (
                    <div className="space-y-4 max-w-5xl mx-auto">
                      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                        <span>
                          Found <strong className="text-white">{unprocessedFiles.length}</strong> stuck files across{" "}
                          <strong className="text-white">{outletKeys.length}</strong> outlets
                        </span>
                      </div>

                      {outletKeys.map((outletId) => {
                        const files = grouped[outletId];
                        const isExpanded = !!expandedOutlets[outletId];
                        const matchedBranch = branches.find((b) => b.id === outletId);

                        return (
                          <div
                            key={outletId}
                            className="bg-slate-900/60 border border-amber-500/20 rounded-2xl overflow-hidden shadow-sm transition-all"
                          >
                            {/* Accordion Outlet Header */}
                            <div className="p-3.5 bg-amber-500/5 hover:bg-amber-500/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <button
                                onClick={() =>
                                  setExpandedOutlets((prev) => ({ ...prev, [outletId]: !prev[outletId] }))
                                }
                                className="flex items-center gap-3 text-left focus:outline-none"
                              >
                                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm text-white">{outletId}</span>
                                    {matchedBranch && (
                                      <span className="text-xs text-slate-400">({matchedBranch.name})</span>
                                    )}
                                    <span className="bg-amber-500/20 text-amber-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                                      {files.length} file{files.length !== 1 ? "s" : ""}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            </div>

                            {/* Files List */}
                            {isExpanded && (
                              <div className="divide-y divide-white/[0.04] bg-black/40">
                                {files.map((file, i) => {
                                  const fileName = file.FILE_NAME || file.file_name || "—";
                                  const queueTime = file.QUEUE_TIME || file.queue_time;
                                  const errMsg = file.ERROR_MESSAGE || file.error_message;

                                  return (
                                    <div key={i} className="p-3.5 hover:bg-white/[0.02] transition-colors">
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1">
                                        <span className="font-mono text-xs font-semibold text-slate-200">
                                          {fileName}
                                        </span>
                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                          <Clock className="h-3 w-3 text-amber-400" />
                                          <span>Queued:</span>
                                          <span className="font-mono text-amber-300">
                                            {queueTime ? new Date(queueTime).toLocaleString() : "Unknown"}
                                          </span>
                                        </div>
                                      </div>

                                      {errMsg && (
                                        <div className="mt-2 p-2.5 rounded-lg bg-red-950/30 border border-red-500/30 text-red-300 text-xs font-mono break-all flex items-start gap-2">
                                          <AlertCircle className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                                          <span>{errMsg}</span>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        ) : showUnsynced ? (
          /* =======================================================================
              STATE 3: UNSYNCED OUTLETS VIEW
             ======================================================================= */
          <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/[0.08] bg-slate-900/40">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowUnsynced(false)}
                    className="p-2 rounded-xl bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors border border-white/[0.06]"
                    title="Back to Overview"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2.5">
                      <Activity className="h-5 w-5 text-blue-400" />
                      <span>Unsynced Outlets</span>
                      {unsyncedBranches.length > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {unsyncedBranches.length} outlets
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-400">
                      Branches with last synchronization exceeding {unsyncedHours} hour
                      {unsyncedHours !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>

                {/* Right controls */}
                <div className="flex items-center gap-2">
                  {unsyncedBranches.length > 0 && (
                    <button
                      onClick={() => handlePingAll(unsyncedBranches)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-medium text-emerald-300 border border-emerald-500/30 transition-colors"
                    >
                      <Signal className="h-3.5 w-3.5" />
                      <span>Ping All</span>
                    </button>
                  )}
                  <button
                    onClick={() => handleFetchUnsynced()}
                    disabled={unsyncedLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-white/[0.06] transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${unsyncedLoading ? "animate-spin" : ""}`} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              {/* Threshold Presets & Filter */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pt-2.5 border-t border-white/[0.04]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 flex items-center gap-1.5 shrink-0">
                    <Clock className="h-3.5 w-3.5 text-blue-400" />
                    Sync lag &gt;
                  </span>
                  {[1, 2, 3].map((hrs) => (
                    <button
                      key={hrs}
                      onClick={() => {
                        setUnsyncedHours(hrs);
                        handleFetchUnsynced(hrs);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${unsyncedHours === hrs
                        ? "bg-blue-500/25 text-blue-300 border border-blue-500/50"
                        : "bg-slate-900/80 text-slate-400 hover:text-white border border-white/[0.06]"
                        }`}
                    >
                      {hrs}h
                    </button>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={72}
                      step={1}
                      value={unsyncedHours}
                      onChange={(e) => setUnsyncedHours(Number(e.target.value))}
                      className="w-16 bg-slate-900 border border-white/[0.08] rounded-lg px-2 py-1 text-xs text-white text-center focus:outline-none focus:border-blue-500/50"
                    />
                    <span className="text-xs text-slate-400 mr-1.5">hours</span>
                    <button
                      onClick={() => handleFetchUnsynced()}
                      disabled={unsyncedLoading}
                      className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-lg text-xs font-medium transition-colors"
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {/* Status Filter & Search Group */}
                <div className="flex flex-wrap justify-end gap-2.5">
                  {/* Status Filter (All / Online / Offline) */}
                  <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-white/[0.08] shrink-0">
                    <button
                      onClick={() => setUnsyncedPingFilter("all")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${unsyncedPingFilter === "all"
                        ? "bg-slate-700 text-white shadow-sm"
                        : "text-slate-400 hover:text-white"
                        }`}
                    >
                      <span>All</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
                        {unsyncedBranches.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setUnsyncedPingFilter("online")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${unsyncedPingFilter === "online"
                        ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-sm"
                        : "text-slate-400 hover:text-emerald-300"
                        }`}
                    >
                      <Wifi className="h-3 w-3 text-emerald-400" />
                      <span>Online</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                        {unsyncedOnlineCount}
                      </span>
                    </button>

                    <button
                      onClick={() => setUnsyncedPingFilter("offline")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${unsyncedPingFilter === "offline"
                        ? "bg-red-500/25 text-red-300 border border-red-500/40 shadow-sm"
                        : "text-slate-400 hover:text-red-300"
                        }`}
                    >
                      <WifiOff className="h-3 w-3 text-red-400" />
                      <span>Offline</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-red-500/20 text-red-300 font-bold">
                        {unsyncedOfflineCount}
                      </span>
                    </button>
                  </div>

                  {/* Search within unsynced */}
                  <div className="relative flex-1 sm:flex-initial min-w-[160px]">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Filter unsynced..."
                      value={unsyncedSearch}
                      onChange={(e) => setUnsyncedSearch(e.target.value)}
                      className="w-full bg-slate-900 border border-white/[0.08] rounded-lg pl-8 pr-7 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50"
                    />
                    {unsyncedSearch && (
                      <button
                        onClick={() => setUnsyncedSearch("")}
                        className="absolute right-2 top-1.5 text-slate-400 hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Unsynced Outlets List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
              {unsyncedLoading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
                  <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
                  <span className="text-sm">Scanning sync databases...</span>
                </div>
              ) : filteredUnsynced.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/60 border border-white/[0.08] flex items-center justify-center">
                    {unsyncedPingFilter === "online" ? (
                      <Wifi className="h-8 w-8 text-slate-500" />
                    ) : (
                      <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                    )}
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-semibold text-white mb-1">
                      {unsyncedPingFilter === "offline"
                        ? "No Offline Outlets"
                        : unsyncedPingFilter === "online"
                          ? "No Online Outlets"
                          : "All Stores Synchronized"}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {unsyncedPingFilter !== "all"
                        ? `No unsynced outlets matching '${unsyncedPingFilter}' status.`
                        : `No branches are exceeding ${unsyncedHours} hours of sync lag.`}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 max-w-5xl mx-auto">
                  {filteredUnsynced.map((branch) => {
                    const ping = pingStates[branch.id];

                    return (
                      <div
                        key={branch.id}
                        className="bg-slate-900/60 border border-white/[0.08] hover:border-blue-500/30 rounded-2xl p-4 sm:p-4.5 transition-all flex flex-col xl:flex-row xl:items-center justify-between gap-3.5 shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <a
                              href={`/recovery?branch=${branch.id}`}
                              onClick={(e) => {
                                if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                  e.preventDefault();
                                  handleCheckStatus({ id: branch.id, name: branch.name, ip: branch.ip || "" });
                                }
                              }}
                              className="font-extrabold text-white text-base tracking-tight hover:text-blue-400 transition-colors cursor-pointer select-none"
                              title="Click to check here, or middle-click wheel to open in new tab"
                            >
                              {branch.id}
                            </a>
                            <span className="text-slate-300 text-sm font-medium">{branch.name}</span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-400">
                            {/* IP */}
                            <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-md border border-white/[0.04]">
                              <span className="text-slate-500">IP:</span>
                              <span className="font-mono text-slate-300">{branch.ip || "Unknown"}</span>
                              {branch.ip && (
                                <button
                                  onClick={() => handleCopy(branch.ip, "ip", branch.id)}
                                  className="text-slate-400 hover:text-white transition-colors ml-0.5"
                                  title="Copy IP"
                                >
                                  {copiedIp === branch.id ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Last Sync */}
                            <div className="flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1 rounded-md border border-amber-500/20 text-amber-300 font-mono">
                              <Clock className="h-3 w-3 text-amber-400 shrink-0" />
                              <span>Last Sync:</span>
                              <span className="font-semibold truncate">
                                {branch.lastSyncTime ? new Date(branch.lastSyncTime).toLocaleString() : "Never"}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap pt-2.5 border-t border-white/[0.04] xl:border-t-0 xl:pt-0 justify-end">
                          {/* Ping button */}
                          <button
                            onClick={() => handlePing(branch.id)}
                            disabled={ping === "loading"}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${ping === "up"
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : ping === "down"
                                ? "bg-red-500/15 text-red-300 border-red-500/30"
                                : "bg-slate-800 text-slate-300 border-white/[0.06] hover:bg-slate-700 hover:text-white"
                              }`}
                          >
                            {ping === "loading" ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : ping === "up" ? (
                              <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                            ) : ping === "down" ? (
                              <WifiOff className="h-3.5 w-3.5 text-red-400" />
                            ) : (
                              <Signal className="h-3.5 w-3.5" />
                            )}
                            <span>{ping === "up" ? "Online" : ping === "down" ? "Offline" : "Ping"}</span>
                          </button>

                          {/* Check Status - with middle-click new-tab support */}
                          <a
                            href={`/recovery?branch=${branch.id}`}
                            onClick={(e) => {
                              if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
                                e.preventDefault();
                                handleCheckStatus({ id: branch.id, name: branch.name, ip: branch.ip || "" });
                              }
                            }}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/[0.06] px-3 py-1.5 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer no-underline select-none"
                            title="Click to check status here, or middle-click wheel to open in new tab"
                          >
                            <Search className="h-3.5 w-3.5" />
                            <span>Check</span>
                          </a>

                          {/* Recover button */}
                          <button
                            onClick={() =>
                              handlePromptRecovery({ id: branch.id, name: branch.name, ip: branch.ip || "" })
                            }
                            disabled={execLoading}
                            className="bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 hover:shadow-sm hover:shadow-rose-500/20"
                          >
                            <ServerCrash className="h-3.5 w-3.5" />
                            <span>Recover</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* =======================================================================
              STATE 4: SELECTED BRANCH RECOVERY DETAIL VIEW
             ======================================================================= */
          <div className="flex flex-col h-full animate-in fade-in duration-300">
            {/* Header */}
            <div className="p-4 sm:p-6 border-b border-white/[0.08] bg-slate-900/40">
              {/* Back navigation */}
              <div className="mb-3">
                {returnTo ? (
                  <button
                    onClick={handleGoBack}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors group"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Back to {returnTo === "unsynced" ? "Unsynced Outlets" : "Unprocessed Files"}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedBranch(null)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors group md:hidden"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    <span>Back to Outlets</span>
                  </button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-1.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {selectedBranch?.id}
                    </span>
                    <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                      {selectedBranch?.name}
                    </h2>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-md border border-white/[0.04]">
                      <span className="text-slate-500">Host IP:</span>
                      <span className="font-mono text-slate-300">{selectedBranch?.ip || "Unknown"}</span>
                      {selectedBranch?.ip && (
                        <button
                          onClick={() => handleCopy(selectedBranch.ip, "ip", selectedBranch.id)}
                          className="text-slate-400 hover:text-white transition-colors ml-0.5"
                          title="Copy IP"
                        >
                          {copiedIp === selectedBranch.id ? (
                            <Check className="h-3 w-3 text-emerald-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Header Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Ping status */}
                  <button
                    onClick={() => selectedBranch && handlePing(selectedBranch.id)}
                    disabled={!selectedBranch || pingStates[selectedBranch?.id ?? ""] === "loading"}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border ${pingStates[selectedBranch?.id ?? ""] === "up"
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : pingStates[selectedBranch?.id ?? ""] === "down"
                        ? "bg-red-500/15 text-red-300 border-red-500/30"
                        : "bg-slate-800 text-slate-300 border-white/[0.06] hover:bg-slate-700"
                      }`}
                  >
                    {pingStates[selectedBranch?.id ?? ""] === "loading" ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : pingStates[selectedBranch?.id ?? ""] === "up" ? (
                      <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                    ) : pingStates[selectedBranch?.id ?? ""] === "down" ? (
                      <WifiOff className="h-3.5 w-3.5 text-red-400" />
                    ) : (
                      <Signal className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {pingStates[selectedBranch?.id ?? ""] === "up"
                        ? "Online"
                        : pingStates[selectedBranch?.id ?? ""] === "down"
                          ? "Offline"
                          : "Ping"}
                    </span>
                  </button>

                  {/* Check Status */}
                  <button
                    onClick={() => handleCheckStatus()}
                    disabled={statusLoading || execLoading}
                    className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-medium border border-white/[0.08] transition-colors flex items-center gap-2 shadow-sm"
                  >
                    {statusLoading ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-400" />
                    ) : (
                      <Search className="h-3.5 w-3.5 text-blue-400" />
                    )}
                    <span>{statusLoading ? "Probing..." : "Check Status"}</span>
                  </button>

                  {/* Trigger Recovery */}
                  {!showConfirm && (
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={execLoading}
                      className="bg-gradient-to-r from-rose-600/30 to-red-600/30 hover:from-rose-600/40 hover:to-red-600/40 text-rose-200 border border-rose-500/40 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-sm shadow-rose-500/10"
                    >
                      {execLoading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />
                      ) : (
                        <ServerCrash className="h-3.5 w-3.5 text-rose-400" />
                      )}
                      <span>{execLoading ? "Recovery In Progress..." : "Run Recovery"}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable Content Body */}
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-6">
              {/* Status Error Alert */}
              {statusError && (
                <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-2xl flex items-start gap-3 text-red-300 text-xs animate-in slide-in-from-top-2">
                  <AlertCircle className="h-5 w-5 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <strong className="block font-semibold mb-0.5">Status Check Error</strong>
                    <p className="font-mono break-all">{statusError}</p>
                  </div>
                </div>
              )}

              {/* Confirmation Card / Banner */}
              {showConfirm && (
                <div className="bg-gradient-to-br from-rose-950/40 via-slate-900/90 to-slate-900 border border-rose-500/40 rounded-2xl p-5 shadow-xl shadow-rose-500/10 animate-in zoom-in-95 duration-200">
                  <div className="flex items-start gap-3.5 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center shrink-0">
                      <ShieldAlert className="h-5 w-5 text-rose-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white mb-1">Confirm Service Recovery Routine</h3>
                      <p className="text-xs text-rose-200/80 leading-relaxed mb-3">
                        This operation interacts directly with host system services for outlet{" "}
                        <strong className="text-white font-mono">{selectedBranch?.id}</strong>:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-300">
                        <div className="p-2.5 bg-black/40 rounded-lg border border-white/[0.04]">
                          <strong className="block text-rose-400 mb-0.5">1. Kill Java</strong>
                          Terminates frozen Java/JVM POS sync threads.
                        </div>
                        <div className="p-2.5 bg-black/40 rounded-lg border border-white/[0.04]">
                          <strong className="block text-rose-400 mb-0.5">2. Purge Logs</strong>
                          Cleans hung Catalina workdirs and locks.
                        </div>
                        <div className="p-2.5 bg-black/40 rounded-lg border border-white/[0.04]">
                          <strong className="block text-rose-400 mb-0.5">3. Restart Tomcat</strong>
                          Reboots sync services and verifies listeners.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-rose-500/20">
                    <button
                      onClick={() => setShowConfirm(false)}
                      className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleExecute}
                      disabled={execLoading}
                      className="bg-rose-600 hover:bg-rose-500 text-white px-5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-2 shadow-md shadow-rose-600/30"
                    >
                      {execLoading ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      <span>Execute Recovery Now</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Status Output Terminal (date & atq) */}
              {statusOutput && (
                <div className="bg-slate-950/70 border border-white/[0.08] rounded-2xl overflow-hidden shadow-md animate-in slide-in-from-bottom-3 duration-300">
                  <div className="px-4 py-3 bg-slate-900/70 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 mr-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                      </div>
                      <Terminal className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-xs font-semibold text-slate-200">
                        System Schedule (`atq`) & Clock (`date`)
                      </span>
                    </div>

                    <button
                      onClick={() => handleCopy(statusOutput.output || "", "terminal")}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                    >
                      {copiedTerminal ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="p-4 font-mono text-xs overflow-x-auto whitespace-pre bg-black/50 custom-scrollbar max-h-72">
                    {statusOutput.output ? (
                      <span className="text-emerald-400 leading-relaxed">{statusOutput.output}</span>
                    ) : (
                      <span className="text-slate-500 italic">No scheduled atq jobs currently active.</span>
                    )}
                    {statusOutput.error_output && (
                      <span className="text-red-400 mt-2 block border-t border-red-500/20 pt-2">
                        {statusOutput.error_output}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Streaming Execution Terminal Output */}
              {(execLoading || execResult) && (
                <div className="bg-slate-950/80 border border-rose-500/30 rounded-2xl overflow-hidden shadow-lg animate-in slide-in-from-bottom-4 duration-300">
                  <div className="px-4 py-3 bg-slate-900/80 border-b border-rose-500/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 mr-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                      </div>
                      <ServerCrash className="h-3.5 w-3.5 text-rose-400" />
                      <span className="text-xs font-semibold text-white">Live Recovery Execution Stream</span>
                      {execLoading && (
                        <span className="flex items-center gap-1 text-[10px] text-rose-300 font-mono bg-rose-500/20 px-2 py-0.5 rounded-full border border-rose-500/30 animate-pulse">
                          STREAMING
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {execResult?.success && !execLoading && (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                        </span>
                      )}
                      <button
                        onClick={() =>
                          handleCopy(
                            (execResult?.output || "") + "\n" + (execResult?.error_output || ""),
                            "terminal"
                          )
                        }
                        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy Output</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 font-mono text-xs overflow-x-auto whitespace-pre bg-black/60 custom-scrollbar max-h-96">
                    {execResult?.output && (
                      <span className="text-emerald-400 block leading-relaxed">{execResult.output}</span>
                    )}
                    {execResult?.error_output && (
                      <span className="text-rose-400 block mt-2 leading-relaxed border-t border-rose-500/20 pt-2">
                        {execResult.error_output}
                      </span>
                    )}
                    {execLoading && !execResult?.output && !execResult?.error_output && (
                      <span className="text-slate-500 italic flex items-center gap-2">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin text-rose-400" />
                        Initializing SSH recovery session and streaming stdout...
                      </span>
                    )}
                    <div ref={terminalEndRef} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function RecoveryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400 gap-3">
          <RefreshCw className="h-8 w-8 text-rose-400 animate-spin" />
          <span className="text-sm font-medium">Loading Recovery Portal...</span>
        </div>
      }
    >
      <RecoveryPageContent />
    </Suspense>
  );
}
