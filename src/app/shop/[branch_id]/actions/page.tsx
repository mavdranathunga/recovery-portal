"use client";

import { useEffect, useState, use } from "react";
import { Server, Cpu, HardDrive, Database, Activity, RefreshCw, Play, ArrowLeft, Terminal, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ActionResponse {
  stdout?: string;
  stderr?: string;
  code?: number | null;
  error?: string;
  details?: string;
}

export default function ShopActionsPage({ params }: { params: Promise<{ branch_id: string }> }) {
  const unwrappedParams = use(params);
  const branch_id = unwrappedParams.branch_id.toUpperCase();

  const [loadingStats, setLoadingStats] = useState(false);
  const [statsData, setStatsData] = useState<string | null>(null);
  
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [terminalOutput, setTerminalOutput] = useState<string>("");

  // DB and Tomcat connection checks
  const [dbStatus, setDbStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });
  const [tomcatStatus, setTomcatStatus] = useState<{ loading: boolean; success?: boolean; msg?: string }>({ loading: false });

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch(`/api/shop/${branch_id}/cmd`, {
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

  const checkDb = async () => {
    setDbStatus({ loading: true });
    try {
      const res = await fetch(`/api/shop/${branch_id}/check-oracle`);
      const data = await res.json();
      setDbStatus({ loading: false, success: data.success, msg: data.message || data.error });
    } catch (err: any) {
      setDbStatus({ loading: false, success: false, msg: err.message });
    }
  };

  const checkTomcat = async () => {
    setTomcatStatus({ loading: true });
    try {
      const res = await fetch(`/api/shop/${branch_id}/check-tomcat`);
      const data = await res.json();
      setTomcatStatus({ loading: false, success: data.success, msg: data.message || data.error });
    } catch (err: any) {
      setTomcatStatus({ loading: false, success: false, msg: err.message });
    }
  };

  useEffect(() => {
    fetchStats();
    checkDb();
    checkTomcat();
  }, [branch_id]);

  const runAction = async (action: string) => {
    setLoadingAction(action);
    setTerminalOutput(`Executing ${action}... Please wait.\n`);
    try {
      const res = await fetch(`/api/shop/${branch_id}/cmd`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      const data: ActionResponse = await res.json();
      
      let out = `--- ${action} completed ---\n`;
      if (data.error) {
        out += `Error: ${data.error}\nDetails: ${data.details || ""}\n`;
      } else {
        out += `Exit Code: ${data.code}\n\n[STDOUT]\n${data.stdout || "(empty)"}\n\n[STDERR]\n${data.stderr || "(empty)"}\n`;
      }
      setTerminalOutput(prev => prev + out);

      // Recheck connections if we restarted something
      if (action.includes('restart')) {
        setTimeout(() => {
          if (action.includes('oracle')) checkDb();
          if (action.includes('tomcat')) checkTomcat();
        }, 5000); // give it a few seconds to boot
      }
    } catch (err: any) {
      setTerminalOutput(prev => prev + `\nNetwork/Unknown Error: ${err.message}\n`);
    } finally {
      setLoadingAction(null);
    }
  };

  // Parse basic stats if available
  let loadAvg = "N/A";
  let memFree = "N/A";
  let storageUsage = "N/A";

  if (statsData) {
    const loadMatch = statsData.match(/=== CPU Load ===\s+(.*)/);
    if (loadMatch) loadAvg = loadMatch[1].trim();

    const memMatch = statsData.match(/Mem:\s+\d+\s+(\d+)\s+(\d+)/); // total used free
    if (memMatch) memFree = `${memMatch[2]} MB free`;

    const storageMatch = statsData.match(/\/$/m); // Find line ending with /
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
    <div className="animate-in fade-in duration-500 max-w-6xl mx-auto pb-20">
      <div className="flex items-center gap-4 mb-8">
        <Link href={`/shop/${branch_id}`} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-slate-300">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <Server className="h-6 w-6 text-blue-400" />
            {branch_id} System Console
          </h1>
          <p className="text-slate-400">Diagnostic checks and service management</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* System Stats Card */}
        <div className="md:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-emerald-400" />
              Live Telemetry
            </h2>
            <button 
              onClick={fetchStats}
              disabled={loadingStats}
              className="p-2 bg-slate-800/50 hover:bg-slate-700 rounded-md transition-colors"
            >
              <RefreshCw className={cn("h-4 w-4 text-slate-300", loadingStats && "animate-spin")} />
            </button>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center text-center">
              <Cpu className="h-6 w-6 text-indigo-400 mb-2" />
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Load Avg</span>
              <span className="text-sm font-mono text-slate-200">{loadingStats ? "..." : loadAvg}</span>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center text-center">
              <Database className="h-6 w-6 text-blue-400 mb-2" />
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Memory</span>
              <span className="text-sm font-mono text-slate-200">{loadingStats ? "..." : memFree}</span>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center text-center">
              <HardDrive className="h-6 w-6 text-purple-400 mb-2" />
              <span className="text-xs text-slate-400 font-medium uppercase tracking-wider mb-1">Storage (/)</span>
              <span className="text-sm font-mono text-slate-200">{loadingStats ? "..." : storageUsage}</span>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className="glass-card p-6 flex flex-col justify-center">
          <h2 className="text-lg font-semibold text-white mb-6">Service Health</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-slate-400" />
                <div>
                  <div className="text-sm font-medium text-slate-200">Oracle IBOM</div>
                  <div className="text-xs text-slate-500">{dbStatus.msg || "Checking..."}</div>
                </div>
              </div>
              <div>
                {dbStatus.loading ? <RefreshCw className="h-5 w-5 text-slate-500 animate-spin" /> : 
                 dbStatus.success ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : 
                 <XCircle className="h-5 w-5 text-red-500" />}
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center gap-3">
                <Server className="h-5 w-5 text-slate-400" />
                <div>
                  <div className="text-sm font-medium text-slate-200">Tomcat Web</div>
                  <div className="text-xs text-slate-500">{tomcatStatus.msg || "Checking..."}</div>
                </div>
              </div>
              <div>
                {tomcatStatus.loading ? <RefreshCw className="h-5 w-5 text-slate-500 animate-spin" /> : 
                 tomcatStatus.success ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : 
                 <XCircle className="h-5 w-5 text-red-500" />}
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
             <button onClick={checkDb} disabled={dbStatus.loading} className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors">Check DB</button>
             <button onClick={checkTomcat} disabled={tomcatStatus.loading} className="flex-1 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors">Check Tomcat</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
          
          <ActionBtn 
            label="Oracle Status (SSH)" 
            action="oracle_status" 
            icon={<Activity className="h-4 w-4" />} 
            loading={loadingAction} 
            onClick={runAction} 
          />
          <ActionBtn 
            label="Restart Oracle" 
            action="oracle_restart" 
            icon={<Play className="h-4 w-4" />} 
            loading={loadingAction} 
            onClick={runAction}
            danger
          />
          <div className="h-px w-full bg-slate-800 my-4" />
          <ActionBtn 
            label="Tomcat Status (SSH)" 
            action="tomcat_status" 
            icon={<Activity className="h-4 w-4" />} 
            loading={loadingAction} 
            onClick={runAction} 
          />
          <ActionBtn 
            label="Restart Tomcat" 
            action="tomcat_restart" 
            icon={<Play className="h-4 w-4" />} 
            loading={loadingAction} 
            onClick={runAction}
            danger
          />
        </div>

        <div className="lg:col-span-3 glass-card p-0 flex flex-col h-[500px]">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/50 flex items-center gap-2">
            <Terminal className="h-4 w-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-300">Terminal Output</span>
            <button 
              onClick={() => setTerminalOutput("")}
              className="ml-auto text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="p-4 overflow-auto flex-1 bg-black/40 font-mono text-sm text-slate-300 whitespace-pre-wrap">
            {terminalOutput || "Ready. Select an action to begin."}
          </div>
        </div>
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
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all",
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
