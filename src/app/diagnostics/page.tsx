"use client";

import { useState, useEffect } from "react";
import { Server, Activity, RefreshCw, ChevronRight, Home, Cpu, Database, HardDrive, Play, Search, ArrowLeft, Terminal, CheckCircle2, XCircle, Maximize2, Minimize2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

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
}

export default function DiagnosticsPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  // Diagnostics states
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsData, setStatsData] = useState<string | null>(null);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string>("");
  const [customCommand, setCustomCommand] = useState("");
  const [terminalMaximized, setTerminalMaximized] = useState(false);

  const [dbStatus, setDbStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });
  const [tomcatStatus, setTomcatStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });

  useEffect(() => {
    fetch("/api/branches")
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
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFilteredBranches(branches.filter(b => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)));
  }, [search, branches]);

  const fetchStats = async (branchId: string) => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/shop/${branchId}/cmd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "system_stats" })
      });
      const data = await res.json();
      if (data.error) {
        setStatsData(`Error: ${data.error}\n${data.details || ""}`);
      } else {
        setStatsData(`${data.stdout || ""}\n${data.stderr || ""}`);
      }
    } catch (err: any) {
      setStatsData(`Failed to fetch stats: ${err.message}`);
    } finally {
      setLoadingStats(false);
    }
  };

  const checkDb = async (branchId: string) => {
    setDbStatus({ loading: true });
    try {
      const res = await fetch(`/api/shop/${branchId}/check-oracle`);
      const data = await res.json();
      setDbStatus({ loading: false, success: data.success, msg: data.message || data.error });
    } catch (err: any) {
      setDbStatus({ loading: false, success: false, msg: err.message });
    }
  };

  const checkTomcat = async (branchId: string) => {
    setTomcatStatus({ loading: true });
    try {
      const res = await fetch(`/api/shop/${branchId}/check-tomcat`);
      const data = await res.json();
      setTomcatStatus({ loading: false, success: data.success, msg: data.message || data.error });
    } catch (err: any) {
      setTomcatStatus({ loading: false, success: false, msg: err.message });
    }
  };

  const handleSelectBranch = (b: Branch) => {
    setSelectedBranch(b);
    setStatsData(null);
    setTerminalOutput("");
    setDbStatus({ loading: false });
    setTomcatStatus({ loading: false });

    // Auto-fetch data on select
    fetchStats(b.id);
    checkDb(b.id);
    checkTomcat(b.id);
  };

  const runAction = async (action: string) => {
    if (!selectedBranch) return;
    setLoadingAction(action);
    setTerminalOutput(prev => prev + `\n$ [${action}]\n`);
    try {
      const res = await fetch(`/api/shop/${selectedBranch.id}/cmd`, {
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
      const res = await fetch(`/api/shop/${selectedBranch.id}/cmd`, {
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

  let loadAvg = "N/A";
  let memFree = "N/A";
  let storageUsage = "N/A";

  if (statsData) {
    const loadMatch = statsData.match(/=== CPU Load ===\s+(.*)/);
    if (loadMatch) loadAvg = loadMatch[1].trim();

    const memMatch = statsData.match(/Mem:\s+\d+\s+(\d+)\s+(\d+)/);
    if (memMatch) memFree = `${memMatch[2]} MB free`;

    const storageMatch = statsData.match(/\/$/m);
    if (storageMatch && storageMatch.input) {
      const lines = storageMatch.input.split('\n');
      const rootLine = lines.find(l => l.trim().endsWith('/'));
      if (rootLine) {
        const parts = rootLine.trim().split(/\s+/);
        if (parts.length >= 5) {
          storageUsage = `${parts[2]} / ${parts[1]} (${parts[4]})`;
        }
      }
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[85vh] animate-in fade-in duration-500">

      {/* Sidebar - Branch List */}
      <div className="w-full md:w-1/4 flex flex-col glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-400" />
            Diagnostics
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/diagnostics/mass-runner')}
              className="text-indigo-450 hover:text-indigo-300 transition-colors flex items-center gap-1 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1.5 rounded border border-indigo-500/20"
              title="Mass Command Runner"
            >
              <Terminal className="h-3.5 w-3.5 text-indigo-400" />
              <span className="hidden xl:inline">Mass Run</span>
            </button>
            <button
              onClick={() => router.push('/')}
              className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm bg-slate-800/50 hover:bg-slate-700/50 px-2 py-1.5 rounded"
            >
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </button>
          </div>
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
              <button
                key={branch.id}
                onClick={() => handleSelectBranch(branch)}
                className={`w-full text-left p-3 rounded-lg mb-1 flex items-center justify-between transition-colors ${selectedBranch?.id === branch.id ? 'bg-emerald-600/20 border border-emerald-500/50' : 'hover:bg-slate-800 border border-transparent'}`}
              >
                <div>
                  <div className="font-semibold text-slate-200">{branch.id}</div>
                  <div className="text-xs text-slate-400">{branch.name}</div>
                </div>
                <ChevronRight className={`h-4 w-4 ${selectedBranch?.id === branch.id ? 'text-emerald-400' : 'text-slate-600'}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Panel - Diagnostics */}
      <div className="w-full md:w-3/4 glass-card flex flex-col p-6 overflow-y-auto custom-scrollbar">
        {!selectedBranch ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Server className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg">Select a branch to view System Diagnostics</p>
          </div>
        ) : (
          <div className="animate-in fade-in duration-300 flex flex-col h-full">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-1">{selectedBranch.id} - {selectedBranch.name}</h2>
              <p className="text-slate-400 font-mono text-sm">IP: {selectedBranch.ip}</p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
              {/* Telemetry */}
              <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    Live Telemetry
                  </h3>
                  <button
                    onClick={() => fetchStats(selectedBranch.id)}
                    disabled={loadingStats}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded transition-colors text-slate-400"
                  >
                    <RefreshCw className={cn("h-4 w-4", loadingStats && "animate-spin")} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-slate-950 p-3 rounded-lg flex flex-col items-center text-center">
                    <Cpu className="h-5 w-5 text-indigo-400 mb-1" />
                    <span className="text-[10px] text-slate-500 font-medium uppercase mb-0.5">Load Avg</span>
                    <span className="text-xs font-mono text-slate-300">{loadingStats ? "..." : loadAvg}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg flex flex-col items-center text-center">
                    <Database className="h-5 w-5 text-blue-400 mb-1" />
                    <span className="text-[10px] text-slate-500 font-medium uppercase mb-0.5">Memory</span>
                    <span className="text-xs font-mono text-slate-300">{loadingStats ? "..." : memFree}</span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg flex flex-col items-center text-center">
                    <HardDrive className="h-5 w-5 text-purple-400 mb-1" />
                    <span className="text-[10px] text-slate-500 font-medium uppercase mb-0.5">Storage</span>
                    <span className="text-xs font-mono text-slate-300">{loadingStats ? "..." : storageUsage}</span>
                  </div>
                </div>
              </div>

              {/* Service Health */}
              <div className="bg-slate-900/50 rounded-xl border border-slate-700/50 p-5">
                <h3 className="font-semibold text-white mb-4">Service Health</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <Database className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-300">Oracle-XE</div>
                        <div className="text-[10px] text-slate-500">{dbStatus.msg || "..."}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => checkDb(selectedBranch.id)} disabled={dbStatus.loading} className="p-1 hover:bg-slate-800 rounded">
                        <RefreshCw className={cn("h-3 w-3 text-slate-500", dbStatus.loading && "animate-spin")} />
                      </button>
                      {dbStatus.loading ? null : dbStatus.success ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded border border-slate-800">
                    <div className="flex items-center gap-2.5">
                      <Server className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="text-sm font-medium text-slate-300">Back-Office</div>
                        <div className="text-[10px] text-slate-500">{tomcatStatus.msg || "..."}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => checkTomcat(selectedBranch.id)} disabled={tomcatStatus.loading} className="p-1 hover:bg-slate-800 rounded">
                        <RefreshCw className={cn("h-3 w-3 text-slate-500", tomcatStatus.loading && "animate-spin")} />
                      </button>
                      {tomcatStatus.loading ? null : tomcatStatus.success ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
              {/* Actions Box */}
              {!terminalMaximized && (
                <div className="w-full lg:w-1/3 space-y-3">
                  <h3 className="font-semibold text-white mb-3">Quick Actions</h3>
                  <ActionBtn label="Oracle Status" action="oracle_status" icon={<Activity className="h-4 w-4" />} loading={loadingAction} onClick={runAction} />
                  <ActionBtn label="Restart Oracle" action="oracle_restart" icon={<Play className="h-4 w-4" />} loading={loadingAction} onClick={runAction} danger />
                  <div className="h-px bg-slate-800 my-2" />
                  <ActionBtn label="Restart Tomcat" action="tomcat_restart" icon={<Play className="h-4 w-4" />} loading={loadingAction} onClick={runAction} danger />
                </div>
              )}

              {/* Terminal Box */}
              <div className={`w-full ${terminalMaximized ? '' : 'lg:w-2/3'} border border-slate-700/50 rounded-xl overflow-hidden flex flex-col bg-black/60`}>
                <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-300 uppercase tracking-wider">Terminal Output</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setTerminalOutput("")} className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
                    <button onClick={() => setTerminalMaximized(prev => !prev)} className="text-slate-500 hover:text-slate-300 transition-colors" title={terminalMaximized ? 'Minimize' : 'Maximize'}>
                      {terminalMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="p-4 overflow-y-auto flex-1 font-mono text-xs text-emerald-400 whitespace-pre-wrap">
                  {terminalOutput || "Ready. Select an action to begin."}
                </div>
                {/* Custom Command Input */}
                <form
                  onSubmit={(e) => { e.preventDefault(); runCustomCommand(); }}
                  className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex gap-2 items-center"
                >
                  <span className="text-emerald-500 font-mono text-sm font-bold">$</span>
                  <input
                    type="text"
                    value={customCommand}
                    onChange={(e) => setCustomCommand(e.target.value)}
                    placeholder="Enter custom bash command..."
                    className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-slate-200 placeholder-slate-600 focus:ring-0"
                    disabled={loadingAction !== null}
                  />
                  <button
                    type="submit"
                    disabled={!customCommand.trim() || loadingAction !== null}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded transition-colors flex items-center gap-2"
                  >
                    {loadingAction === 'custom' ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
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

function ActionBtn({ label, action, icon, loading, onClick, danger }: { label: string, action: string, icon: React.ReactNode, loading: string | null, onClick: (a: string) => void, danger?: boolean }) {
  const isLoading = loading === action;
  return (
    <button
      onClick={() => onClick(action)}
      disabled={loading !== null}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all",
        danger
          ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20"
          : "bg-slate-800/50 border-slate-700/50 text-slate-200 hover:bg-slate-800",
        isLoading && "opacity-50 cursor-not-allowed"
      )}
    >
      {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : icon}
      {label}
    </button>
  );
}
