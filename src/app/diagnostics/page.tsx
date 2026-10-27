"use client";

import { useState, useEffect } from "react";
import { Server, Activity, RefreshCw, ChevronRight, Home, Cpu, Database, HardDrive, Play, Search, ArrowLeft, Terminal, CheckCircle2, XCircle, Maximize2, Minimize2, Wifi, WifiOff, Signal, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useOrg } from "@/lib/OrgContext";

interface Branch {
  id: string;
  name: string;
  ip: string;
}

interface ActionResponse {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  error?: string;
  details?: string;
  stats?: SystemStats;
}

interface SystemStats {
  cpu: number | null;
  mem: number | null;
  uptime: string | null;
  mounts: { path: string; pct: number | null }[];
}

const DIAGNOSTICS_MOUNTS = ["/", "/var/spool", "/u01", "/coins", "/storage", "/home"];

/* ─── Ring Meter Component ──────────────────────────────── */
function RingMeter({
  pct,
  icon: Icon,
  label,
  iconClass = "text-blue-400",
  size = 64,
  stroke = 5,
}: {
  pct: number | null;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  iconClass?: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const safePct = pct === null ? 0 : Math.min(100, Math.max(0, pct));
  const dash = (safePct / 100) * circ;

  const ringColor =
    pct === null
      ? "#334155"
      : pct >= 85
        ? "#f43f5e"
        : pct >= 70
          ? "#f59e0b"
          : "#10b981";

  const textColor =
    pct === null
      ? "text-slate-500"
      : pct >= 85
        ? "text-rose-400"
        : pct >= 70
          ? "text-amber-400"
          : "text-emerald-400";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{ transformOrigin: "50% 50%" }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeDasharray={circ}
            strokeDashoffset={circ - dash}
            strokeLinecap="round"
            style={{
              transition: "stroke-dashoffset 0.85s cubic-bezier(0.16,1,0.3,1), stroke 0.4s ease",
              filter: pct !== null ? `drop-shadow(0 0 5px ${ringColor}90)` : "none",
            }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className={`w-4 h-4 ${iconClass}`} />
        </div>
      </div>
      <div className={`text-[11px] font-bold font-mono ${textColor}`}>
        {pct !== null ? `${pct}%` : "N/A"}
      </div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

/* ─── Utilization Bar ───────────────────────────────────── */
function UtilBar({ pct }: { pct: number | null }) {
  const barColor =
    pct === null
      ? "bg-slate-700"
      : pct >= 85
        ? "bg-gradient-to-r from-rose-600 to-rose-400"
        : pct >= 70
          ? "bg-gradient-to-r from-amber-600 to-amber-400"
          : "bg-gradient-to-r from-emerald-600 to-emerald-400";

  const glow =
    pct !== null && pct >= 85
      ? "0 0 8px rgba(244,63,94,0.55)"
      : pct !== null && pct >= 70
        ? "0 0 8px rgba(245,158,11,0.5)"
        : pct !== null
          ? "0 0 6px rgba(16,185,129,0.4)"
          : "none";

  return (
    <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
        style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%`, boxShadow: glow }}
      />
    </div>
  );
}

export default function DiagnosticsPage() {
  const router = useRouter();
  const { org } = useOrg();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // Diagnostics states
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsData, setStatsData] = useState<string | null>(null);
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [customCommand, setCustomCommand] = useState("");
  const [terminalMaximized, setTerminalMaximized] = useState(false);

  const [dbStatus, setDbStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });
  const [tomcatStatus, setTomcatStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });

  // Per-branch ping state
  const [pingStates, setPingStates] = useState<Record<string, 'loading' | 'up' | 'down' | 'unknown'>>({});

  useEffect(() => {
    setLoading(true);
    setSelectedBranch(null); // Reset selection on org switch
    fetch(`/api/branches?org=${org}`)
      .then(res => res.json())
      .then(data => {
        if (data.branches) {
          setBranches(data.branches);
          setFilteredBranches(data.branches);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [org]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFilteredBranches(branches.filter(b => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)));
  }, [search, branches]);

  const fetchStats = async (branchId: string) => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/shop/${branchId}/cmd?org=${org}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "system_stats" })
      });
      const data: ActionResponse = await res.json();
      if (data.error) {
        setStatsData(`Error: ${data.error}\n${data.details || ""}`);
        setSystemStats(null);
      } else {
        setStatsData(`${data.stdout || ""}\n${data.stderr || ""}`);
        if (data.stats) {
          setSystemStats(data.stats);
        } else if (data.stdout) {
          const matchCpu = data.stdout.match(/CPU:([0-9.]+)/);
          const matchMem = data.stdout.match(/MEM:([0-9.]+)/);
          const matchUptime = data.stdout.match(/UPTIME:(.+)/);
          const parsedMounts = DIAGNOSTICS_MOUNTS.map((m) => {
            const safe = m.replace(/\//g, "_").replace(/^_/, "") || "root";
            const re = new RegExp(`MOUNT_${safe}:([0-9]+|N\\/A)`);
            const match = data.stdout?.match(re);
            const raw = match ? match[1] : null;
            return {
              path: m,
              pct: raw && raw !== "N/A" ? parseInt(raw, 10) : null,
            };
          });
          setSystemStats({
            cpu: matchCpu && !isNaN(parseFloat(matchCpu[1])) ? Math.round(parseFloat(matchCpu[1])) : null,
            mem: matchMem && !isNaN(parseFloat(matchMem[1])) ? Math.round(parseFloat(matchMem[1])) : null,
            uptime: matchUptime ? matchUptime[1].trim() : null,
            mounts: parsedMounts,
          });
        }
      }
    } catch (err: any) {
      setStatsData(`Failed to fetch stats: ${err.message}`);
      setSystemStats(null);
    } finally {
      setLoadingStats(false);
    }
  };

  const checkDb = async (branchId: string) => {
    setDbStatus({ loading: true });
    try {
      const res = await fetch(`/api/shop/${branchId}/check-oracle?org=${org}`);
      const data = await res.json();
      setDbStatus({ loading: false, success: data.success, msg: data.message || data.error });
    } catch (err: any) {
      setDbStatus({ loading: false, success: false, msg: err.message });
    }
  };

  const checkTomcat = async (branchId: string) => {
    setTomcatStatus({ loading: true });
    try {
      const res = await fetch(`/api/shop/${branchId}/check-tomcat?org=${org}`);
      const data = await res.json();
      setTomcatStatus({ loading: false, success: data.success, msg: data.message || data.error });
    } catch (err: any) {
      setTomcatStatus({ loading: false, success: false, msg: err.message });
    }
  };

  const handleSelectBranch = (b: Branch) => {
    setSelectedBranch(b);
    setStatsData(null);
    setSystemStats(null);
    setTerminalOutput("");
    setDbStatus({ loading: false });
    setTomcatStatus({ loading: false });

    // Auto-fetch data on select
    fetchStats(b.id);
    checkDb(b.id);
    checkTomcat(b.id);
    handlePing(b.id);
  };

  const handlePing = async (branchId: string) => {
    setPingStates(prev => ({ ...prev, [branchId]: 'loading' }));
    try {
      const res = await fetch(`/api/ping/${branchId}?org=${org}`);
      const data = await res.json();
      if (data.error || !data.reachable) {
        setPingStates(prev => ({ ...prev, [branchId]: 'down' }));
      } else {
        setPingStates(prev => ({ ...prev, [branchId]: 'up' }));
      }
    } catch {
      setPingStates(prev => ({ ...prev, [branchId]: 'down' }));
    }
  };

  const runAction = async (action: string) => {
    if (!selectedBranch) return;
    setLoadingAction(action);
    setTerminalOutput(prev => prev + `\n$ [${action}]\n`);
    try {
      const res = await fetch(`/api/shop/${selectedBranch.id}/cmd?org=${org}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data: ActionResponse = await res.json();

      let out = "";
      if (data.error) {
        out += `Error: ${data.error}\nDetails: ${data.details || ""}\n`;
      } else {
        if (data.stdout) out += data.stdout;
        if (data.stderr) out += data.stderr;
        if (out && !out.endsWith('\n')) out += '\n';
      }
      setTerminalOutput(prev => prev + out);

      if (action.includes('restart')) {
        setTimeout(() => {
          if (action.includes('oracle')) checkDb(selectedBranch.id);
          if (action.includes('tomcat')) checkTomcat(selectedBranch.id);
        }, 5000);
      }
    } catch (err: any) {
      setTerminalOutput(prev => prev + `\nNetwork/Unknown Error: ${err.message}\n`);
    } finally {
      setLoadingAction(null);
    }
  };

  const runCustomCommand = async () => {
    if (!selectedBranch || !customCommand.trim()) return;
    const cmdToRun = customCommand.trim();
    setCustomCommand(""); // clear input early
    setLoadingAction('custom');
    setTerminalOutput(prev => prev + `\n$ ${cmdToRun}\n`);

    try {
      const res = await fetch(`/api/shop/${selectedBranch.id}/cmd?org=${org}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "custom", command: cmdToRun })
      });

      const data: ActionResponse = await res.json();

      let out = "";
      if (data.error) {
        out += `Error: ${data.error}\nDetails: ${data.details || ""}\n`;
      } else {
        if (data.stdout) out += data.stdout;
        if (data.stderr) out += data.stderr;
        if (out && !out.endsWith('\n')) out += '\n';
      }
      setTerminalOutput(prev => prev + out);
    } catch (err: any) {
      setTerminalOutput(prev => prev + `\nNetwork/Unknown Error: ${err.message}\n`);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-[calc(100vh-6rem)] animate-in fade-in duration-500 pb-10">

      {/* Sidebar - Branch List (hidden on mobile when a branch is selected) */}
      <div className={`w-full md:w-80 md:shrink-0 flex-col glass-card overflow-hidden h-[450px] md:h-[calc(100vh-6rem)] md:sticky md:top-6 ${selectedBranch ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Diagnostics
          </h2>
        </div>
        <div className="p-4 border-b border-white/10">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search branches..."
              className="w-full bg-slate-900 border border-slate-700 rounded-md pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center p-8"><RefreshCw className="h-6 w-6 text-slate-400 animate-spin" /></div>
          ) : (
            filteredBranches.map(branch => (
              <div
                key={branch.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectBranch(branch)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectBranch(branch); }}
                className={`w-full text-left p-3 rounded-lg mb-1 flex items-center justify-between transition-colors cursor-pointer ${selectedBranch?.id === branch.id ? 'bg-emerald-600/20 border border-emerald-500/50' : 'hover:bg-slate-800 border border-transparent'}`}
              >
                <div>
                  <div className="font-semibold text-slate-200">{branch.id}</div>
                  <div className="text-xs text-slate-400">{branch.name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePing(branch.id); }}
                    disabled={pingStates[branch.id] === 'loading'}
                    title={branch.ip || 'Ping'}
                    className={`p-1.5 rounded transition-colors ${pingStates[branch.id] === 'up'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : pingStates[branch.id] === 'down'
                        ? 'text-red-400 bg-red-500/10'
                        : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700'
                      }`}
                  >
                    {pingStates[branch.id] === 'loading' ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : pingStates[branch.id] === 'up' ? (
                      <Wifi className="h-3.5 w-3.5" />
                    ) : pingStates[branch.id] === 'down' ? (
                      <WifiOff className="h-3.5 w-3.5" />
                    ) : (
                      <Signal className="h-3.5 w-3.5" />
                    )}
                  </button>
                  <ChevronRight className={`h-4 w-4 ${selectedBranch?.id === branch.id ? 'text-emerald-400' : 'text-slate-600'}`} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Panel - Diagnostics */}
      <div className={`w-full flex-1 flex-col glass-card p-4 sm:p-6 ${!selectedBranch ? 'hidden md:flex' : 'flex'}`}>
        {!selectedBranch ? (
          <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] select-none">
            {/* Glowing icon */}
            <div className="relative mb-6">
              <div className="absolute inset-0 rounded-2xl bg-emerald-500/20 blur-xl scale-150" />
              <div className="relative w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <Server className="h-10 w-10 text-emerald-400 opacity-70" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white tracking-tight mb-2">
              No Outlet Selected
            </h3>
            <p className="text-slate-500 text-sm text-center max-w-xs mb-8 leading-relaxed">
              Choose a branch from the left panel to view live telemetry, service health checks, and run remote commands.
            </p>

            {/* Feature hints */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
              <div className="glass-card p-3.5 rounded-xl border border-white/[0.06] flex flex-col items-center gap-2 text-center">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <span className="text-[11px] font-semibold text-slate-300">Live Telemetry</span>
                <span className="text-[10px] text-slate-600 leading-tight">CPU, RAM & storage mounts</span>
              </div>
              <div className="glass-card p-3.5 rounded-xl border border-white/[0.06] flex flex-col items-center gap-2 text-center">
                <div className="p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                  <CheckCircle2 className="h-4 w-4 text-violet-400" />
                </div>
                <span className="text-[11px] font-semibold text-slate-300">Service Health</span>
                <span className="text-[10px] text-slate-600 leading-tight">Oracle DB & Tomcat status</span>
              </div>
              <div className="glass-card p-3.5 rounded-xl border border-white/[0.06] flex flex-col items-center gap-2 text-center">
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <Terminal className="h-4 w-4 text-amber-400" />
                </div>
                <span className="text-[11px] font-semibold text-slate-300">Remote Terminal</span>
                <span className="text-[10px] text-slate-600 leading-tight">Run commands over SSH</span>
              </div>
            </div>

            {/* Arrow hint */}
            <div className="mt-8 flex items-center gap-2 text-xs text-slate-600 font-mono">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Select an outlet from the left panel to get started</span>
            </div>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 flex flex-col space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <button
                  onClick={() => setSelectedBranch(null)}
                  className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs mb-2 transition-colors group md:hidden"
                >
                  <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                  Back to Outlets
                </button>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-1">{selectedBranch.id} - {selectedBranch.name}</h2>
                <div className="flex flex-wrap items-center gap-2 text-slate-400 font-mono text-xs sm:text-sm">
                  <span>IP: {selectedBranch.ip}</span>
                  {systemStats?.uptime && (
                    <>
                      <span className="text-slate-600">·</span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-mono text-slate-300 bg-white/[0.04] border border-white/[0.08]">
                        <Timer className="w-3.5 h-3.5 text-emerald-400" />
                        <span>up {systemStats.uptime}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick status badge */}
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              </div>
            </div>

            {/* Upper Row: Telemetry & Service Health */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Telemetry Card */}
              <div
                className="rounded-2xl border border-white/[0.08] p-5 flex flex-col justify-between"
                style={{
                  background: "rgba(15,23,42,0.6)",
                  backdropFilter: "blur(14px)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Activity className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">Live Telemetry</h3>
                        <p className="text-[11px] text-slate-500">Resource utilization & mounts</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fetchStats(selectedBranch.id)}
                        disabled={loadingStats}
                        className="p-1.5 bg-slate-800/80 hover:bg-slate-700/80 border border-white/[0.06] rounded-lg transition-colors text-slate-400 hover:text-white"
                        title="Refresh metrics"
                      >
                        <RefreshCw className={cn("h-4 w-4", loadingStats && "animate-spin")} />
                      </button>
                    </div>
                  </div>

                  {/* CPU and RAM Rings */}
                  <div className="flex items-center justify-around py-3 mb-4 rounded-xl bg-slate-950/50 border border-white/[0.04]">
                    <RingMeter
                      pct={systemStats?.cpu ?? null}
                      icon={Cpu}
                      label="CPU"
                      iconClass="text-blue-400"
                      size={68}
                    />
                    <RingMeter
                      pct={systemStats?.mem ?? null}
                      icon={Database}
                      label="RAM"
                      iconClass="text-violet-400"
                      size={68}
                    />
                  </div>

                  {/* Named storage mount point bars (Clean 2-column grid) */}
                  <div className="space-y-2.5 pt-3 border-t border-white/[0.06]">
                    <div className="flex items-center justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      <span className="flex items-center gap-1.5">
                        <HardDrive className="w-3 h-3 text-purple-400" />
                        Storage Partitions
                      </span>
                      {loadingStats && (
                        <span className="text-[10px] text-slate-500 font-normal lowercase flex items-center gap-1">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" /> polling...
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2.5">
                      {DIAGNOSTICS_MOUNTS.map((mountPath) => {
                        const mountData = systemStats?.mounts?.find((m) => m.path === mountPath);
                        const pct = mountData ? mountData.pct : null;

                        return (
                          <div key={mountPath} className="space-y-1">
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="font-mono text-slate-400">{mountPath}</span>
                              <span
                                className={`font-mono font-semibold ${pct === null
                                  ? "text-slate-600"
                                  : pct >= 85
                                    ? "text-rose-400"
                                    : pct >= 70
                                      ? "text-amber-400"
                                      : "text-emerald-400"
                                  }`}
                              >
                                {pct !== null ? `${pct}%` : "—"}
                              </span>
                            </div>
                            <UtilBar pct={pct} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Health */}
              <div
                className="rounded-2xl border border-white/[0.08] p-5 flex flex-col justify-between"
                style={{
                  background: "rgba(15,23,42,0.6)",
                  backdropFilter: "blur(14px)",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                        <Server className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">Service Health</h3>
                        <p className="text-[11px] text-slate-500">Core database & application daemons</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 bg-slate-950/50 rounded-xl border border-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                          <Database className="h-4 w-4 text-indigo-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-200">Oracle-XE</div>
                          <div className="text-[11px] text-slate-500">{dbStatus.msg || "Status unknown"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => checkDb(selectedBranch.id)}
                          disabled={dbStatus.loading}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="Check Oracle"
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", dbStatus.loading && "animate-spin")} />
                        </button>
                        {dbStatus.loading ? null : dbStatus.success ? (
                          <span className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          </span>
                        ) : (
                          <span className="p-1 rounded-md bg-rose-500/10 border border-rose-500/20">
                            <XCircle className="h-4 w-4 text-rose-400" />
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3.5 bg-slate-950/50 rounded-xl border border-white/[0.04]">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/20">
                          <Server className="h-4 w-4 text-sky-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-200">Back-Office</div>
                          <div className="text-[11px] text-slate-500">{tomcatStatus.msg || "Status unknown"}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => checkTomcat(selectedBranch.id)}
                          disabled={tomcatStatus.loading}
                          className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                          title="Check Tomcat"
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", tomcatStatus.loading && "animate-spin")} />
                        </button>
                        {tomcatStatus.loading ? null : tomcatStatus.success ? (
                          <span className="p-1 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          </span>
                        ) : (
                          <span className="p-1 rounded-md bg-rose-500/10 border border-rose-500/20">
                            <XCircle className="h-4 w-4 text-rose-400" />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Lower Row: Quick Actions & Terminal Output */}
            <div className="flex flex-col lg:flex-row gap-6 pt-2">
              {/* Quick Actions Card */}
              {!terminalMaximized && (
                <div
                  className="w-full lg:w-80 shrink-0 rounded-2xl border border-white/[0.08] p-5 flex flex-col justify-between"
                  style={{
                    background: "rgba(15,23,42,0.6)",
                    backdropFilter: "blur(14px)",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
                  }}
                >
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <Play className="h-4 w-4 text-amber-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">Quick Actions</h3>
                        <p className="text-[11px] text-slate-500">Service controls & operations</p>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <ActionBtn
                        label="Oracle Status"
                        action="oracle_status"
                        icon={<Activity className="h-4 w-4 text-blue-400" />}
                        loading={loadingAction}
                        onClick={runAction}
                      />
                      <ActionBtn
                        label="Restart Oracle"
                        action="oracle_restart"
                        icon={<Play className="h-4 w-4 text-rose-400" />}
                        loading={loadingAction}
                        onClick={runAction}
                        danger
                      />
                      <div className="h-px bg-white/[0.06] my-1.5" />
                      <ActionBtn
                        label="Restart Tomcat"
                        action="tomcat_restart"
                        icon={<Play className="h-4 w-4 text-amber-400" />}
                        loading={loadingAction}
                        onClick={runAction}
                        danger
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Terminal Box */}
              <div
                className="flex-1 min-h-[340px] rounded-2xl border border-white/[0.08] overflow-hidden flex flex-col shadow-2xl"
                style={{
                  background: "rgba(10,14,26,0.85)",
                  backdropFilter: "blur(14px)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)",
                }}
              >
                {/* Terminal Header */}
                <div className="px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex items-center gap-1.5 mr-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <Terminal className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-semibold text-slate-300 font-mono tracking-wider">TERMINAL CONSOLE</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTerminalOutput("")}
                      className="px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setTerminalMaximized((prev) => !prev)}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
                      title={terminalMaximized ? "Minimize" : "Maximize"}
                    >
                      {terminalMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Terminal Output */}
                <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-emerald-400 whitespace-pre-wrap min-h-[190px] max-h-[420px] custom-scrollbar selection:bg-emerald-500/30">
                  {terminalOutput || "Ready. Select an action above or execute a custom bash command below."}
                </div>

                {/* Custom Command Input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runCustomCommand();
                  }}
                  className="px-4 py-3 bg-black/50 border-t border-white/[0.06] flex gap-2.5 items-center"
                >
                  <span className="text-emerald-400 font-mono text-sm font-bold">$</span>
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="Enter bash command (e.g., uptime, ps -ef | grep java, df -h)..."
                    className="flex-1 bg-transparent border-none outline-none font-mono text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:ring-0"
                    disabled={loadingAction !== null}
                  />
                  <button
                    type="submit"
                    disabled={!customCommand.trim() || loadingAction !== null}
                    className="px-4 py-1.5 rounded-lg font-medium text-xs text-white transition-all duration-200 active:scale-95 disabled:opacity-40 hover:brightness-110 flex items-center gap-1.5 shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
                      boxShadow: "0 2px 10px rgba(37,99,235,0.3)",
                    }}
                  >
                    {loadingAction === "custom" ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    Run
                  </button>
                </form>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}

function ActionBtn({
  label,
  action,
  icon,
  loading,
  onClick,
  danger,
}: {
  label: string;
  action: string;
  icon: React.ReactNode;
  loading: string | null;
  onClick: (a: string) => void;
  danger?: boolean;
}) {
  const isLoading = loading === action;
  return (
    <button
      onClick={() => onClick(action)}
      disabled={loading !== null}
      className={cn(
        "w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all duration-200 active:scale-[0.98]",
        danger
          ? "bg-rose-500/10 border-rose-500/25 text-rose-300 hover:bg-rose-500/20 hover:border-rose-500/40 shadow-sm shadow-rose-950/30"
          : "bg-white/[0.04] border-white/[0.08] text-slate-200 hover:bg-white/[0.08] hover:border-white/[0.15] shadow-sm",
        isLoading && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className="flex items-center gap-2.5">
        {isLoading ? <RefreshCw className="h-4 w-4 animate-spin text-slate-400" /> : icon}
        <span>{label}</span>
      </span>
      <ChevronRight className="w-3.5 h-3.5 opacity-40" />
    </button>
  );
}
