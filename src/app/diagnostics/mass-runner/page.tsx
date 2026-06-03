"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Terminal, Play, StopCircle, RefreshCw, Search, ChevronLeft, 
  CheckCircle2, XCircle, AlertCircle, Info, Download, Sliders, CheckSquare, Square
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
  ip: string;
  category: string;
}

interface RunResult {
  branchId: string;
  branchName: string;
  ip: string;
  status: "pending" | "running" | "success" | "failed";
  stdout: string;
  stderr: string;
  code: number | null;
  duration?: number;
}

const COMMAND_TEMPLATES = [
  { label: "Check Storage (Root)", command: "df -h /" },
  { label: "Check Memory Usage", command: "free -m" },
  { label: "Check CPU & Load Avg", command: "cat /proc/loadavg" },
  { label: "Check System Uptime", command: "uptime" },
  { label: "Check Oracle Service Status", command: "sudo service oracle-xe status" },
  { label: "Check Tomcat Service Status", command: "sudo service tomcat status" },
  { label: "Custom Bash Command", command: "" }
];

export default function MassRunnerPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Shop" | "Warehouse">("All");
  const [loading, setLoading] = useState(true);
  
  // Selection
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());
  
  // Execution Config
  const [command, setCommand] = useState("df -h /");
  const [concurrency, setConcurrency] = useState(10);
  
  // Run State
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [isRunning, setIsRunning] = useState(false);
  const stopFlag = useRef(false);
  
  // Selected result for detail view modal
  const [activeResultId, setActiveResultId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => {
        if (data.branches) {
          setBranches(data.branches);
          // By default, select all branches
          setSelectedBranchIds(new Set(data.branches.map((b: Branch) => b.id)));
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load branches:", err);
        setLoading(false);
      });
  }, []);

  const filteredBranches = branches.filter((b) => {
    const matchesSearch = 
      b.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.ip.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === "All" || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const toggleSelectAll = () => {
    const visibleIds = filteredBranches.map((b) => b.id);
    const allVisibleSelected = visibleIds.every((id) => selectedBranchIds.has(id));

    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleSelectBranch = (id: string) => {
    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const startMassRun = async () => {
    if (!command.trim() || selectedBranchIds.size === 0 || isRunning) return;

    setIsRunning(true);
    stopFlag.current = false;

    // Initialize/Reset results for selected branches
    const initialResults: Record<string, RunResult> = { ...results };
    branches.forEach((b) => {
      if (selectedBranchIds.has(b.id)) {
        initialResults[b.id] = {
          branchId: b.id,
          branchName: b.name,
          ip: b.ip,
          status: "pending",
          stdout: "",
          stderr: "",
          code: null
        };
      }
    });
    setResults(initialResults);

    const targets = branches.filter((b) => selectedBranchIds.has(b.id));
    let index = 0;

    const executeNext = async () => {
      if (stopFlag.current || index >= targets.length) return;

      const branch = targets[index++];
      
      // Update state to running
      setResults((prev) => ({
        ...prev,
        [branch.id]: { ...prev[branch.id], status: "running" }
      }));

      const startTime = Date.now();
      try {
        const res = await fetch(`/api/shop/${branch.id}/cmd`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "custom", command: command.trim() })
        });
        
        const data = await res.json();
        const duration = Date.now() - startTime;

        if (data.error) {
          setResults((prev) => ({
            ...prev,
            [branch.id]: {
              ...prev[branch.id],
              status: "failed",
              stderr: data.error + (data.details ? `\nDetails: ${data.details}` : ""),
              duration
            }
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            [branch.id]: {
              ...prev[branch.id],
              status: data.code === 0 ? "success" : "failed",
              stdout: data.stdout || "",
              stderr: data.stderr || "",
              code: data.code,
              duration
            }
          }));
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        setResults((prev) => ({
          ...prev,
          [branch.id]: {
            ...prev[branch.id],
            status: "failed",
            stderr: err.message || "Network request failed",
            duration
          }
        }));
      }

      // recurse to keep concurrency pool active
      await executeNext();
    };

    // Spawn execution pools
    const pools = [];
    const poolCount = Math.min(concurrency, targets.length);
    for (let i = 0; i < poolCount; i++) {
      pools.push(executeNext());
    }

    await Promise.all(pools);
    setIsRunning(false);
  };

  const stopExecution = () => {
    stopFlag.current = true;
    setIsRunning(false);
  };

  // Stats calculation
  const totalSelected = selectedBranchIds.size;
  const processed = Object.values(results).filter(
    (r) => selectedBranchIds.has(r.branchId) && r.status !== "pending"
  );
  const completedCount = processed.filter((r) => r.status === "success" || r.status === "failed").length;
  const successCount = processed.filter((r) => r.status === "success").length;
  const failedCount = processed.filter((r) => r.status === "failed").length;
  const runningCount = processed.filter((r) => r.status === "running").length;

  const progressPercent = totalSelected > 0 ? Math.round((completedCount / totalSelected) * 100) : 0;

  // Export results to CSV
  const exportToCSV = () => {
    const csvRows = [
      ["Branch ID", "Branch Name", "IP Address", "Status", "Exit Code", "Duration (ms)", "Stdout", "Stderr"]
    ];

    Object.values(results).forEach((r) => {
      if (selectedBranchIds.has(r.branchId)) {
        csvRows.push([
          r.branchId,
          r.branchName,
          r.ip,
          r.status,
          r.code !== null ? String(r.code) : "N/A",
          r.duration ? String(r.duration) : "0",
          r.stdout.replace(/\n/g, "  "),
          r.stderr.replace(/\n/g, "  ")
        ]);
      }
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + csvRows.map((e) => e.map((val) => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mass_command_results_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6 min-h-[85vh] animate-in fade-in duration-500 pb-12">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/diagnostics")}
            className="text-slate-400 hover:text-white transition-colors flex items-center justify-center bg-slate-800/80 p-2.5 rounded-xl border border-slate-700/60"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Terminal className="h-6 w-6 text-indigo-400" />
              Mass Command Runner
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">Run safe diagnostics and administration commands across multiple shop servers simultaneously.</p>
          </div>
        </div>

        {completedCount > 0 && (
          <button
            onClick={exportToCSV}
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Export Results (.csv)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Left Side: Setup & Command Config */}
        <div className="lg:col-span-1 flex flex-col gap-6 bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-white/5 pb-3">
            <Sliders className="h-5 w-5 text-indigo-400" />
            Configuration
          </h2>

          {/* Template Select */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Command Template</label>
            <select
              onChange={(e) => {
                const selectedVal = e.target.value;
                if (selectedVal) setCommand(selectedVal);
              }}
              className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              {COMMAND_TEMPLATES.map((tmpl) => (
                <option key={tmpl.label} value={tmpl.command}>
                  {tmpl.label}
                </option>
              ))}
            </select>
          </div>

          {/* Command Code Input */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">Terminal Command</label>
            <div className="relative font-mono text-sm bg-black/60 border border-slate-800 rounded-xl overflow-hidden focus-within:border-indigo-500 transition-colors">
              <span className="absolute left-4 top-3.5 text-indigo-500 font-bold">$</span>
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder="Enter custom terminal command..."
                className="w-full bg-transparent border-none outline-none focus:ring-0 pl-8 pr-4 py-3.5 min-h-[100px] text-slate-200 font-mono text-sm"
                disabled={isRunning}
              />
            </div>
          </div>

          {/* Concurrency settings */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Concurrency Limit</span>
              <span className="font-mono text-indigo-400">{concurrency} Parallel</span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value))}
              disabled={isRunning}
              className="w-full h-2 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Action trigger button */}
          <div className="pt-2">
            {isRunning ? (
              <button
                onClick={stopExecution}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 border border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.2)]"
              >
                <StopCircle className="h-5 w-5" />
                Stop Execution
              </button>
            ) : (
              <button
                onClick={startMassRun}
                disabled={selectedBranchIds.size === 0 || !command.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 border border-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.3)]"
              >
                <Play className="h-4 w-4 fill-current" />
                Run on {selectedBranchIds.size} Outlets
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Outlet selection & Results Grid */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* Live Progress Bar panel if active or finished */}
          {(isRunning || completedCount > 0) && (
            <div className="bg-slate-900/60 backdrop-blur-md p-6 rounded-2xl border border-slate-800 flex flex-col gap-4 animate-in slide-in-from-top-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-sm font-bold text-slate-300">
                  {isRunning ? "Executing Mass Run..." : "Execution Finished"}
                </span>
                <span className="font-mono text-xs text-slate-400">
                  {completedCount} / {totalSelected} Complete ({progressPercent}%)
                </span>
              </div>
              <div className="h-2.5 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-500 transition-all duration-300 ease-out"
                  style={{ width: `${progressPercent}%` }}
                ></div>
              </div>

              {/* Status metrics grid */}
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-slate-500 mb-0.5">Success</div>
                  <div className="font-bold text-emerald-400 text-sm font-mono">{successCount}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-slate-500 mb-0.5">Failed</div>
                  <div className="font-bold text-red-400 text-sm font-mono">{failedCount}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-slate-500 mb-0.5">Running</div>
                  <div className="font-bold text-blue-400 text-sm font-mono animate-pulse">{runningCount}</div>
                </div>
                <div className="bg-slate-950/60 border border-slate-800 p-2.5 rounded-xl">
                  <div className="text-slate-500 mb-0.5">Total</div>
                  <div className="font-bold text-slate-300 text-sm font-mono">{totalSelected}</div>
                </div>
              </div>
            </div>
          )}

          {/* Outlets List + Search Panel */}
          <div className="bg-slate-900/40 backdrop-blur-sm border border-slate-800 rounded-2xl flex flex-col overflow-hidden flex-1 min-h-[450px]">
            <div className="p-4 border-b border-white/5 bg-slate-950/30 flex flex-col sm:flex-row gap-3 items-center justify-between">
              
              {/* Search + Category Filters */}
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="relative w-full sm:w-60">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search outlets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex border border-slate-800 bg-slate-950 rounded-lg overflow-hidden p-0.5">
                  {(["All", "Shop", "Warehouse"] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors ${
                        categoryFilter === cat ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {cat}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Master Select Toggle */}
              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold flex items-center gap-2 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 px-3 py-2 rounded-lg border border-indigo-500/20 whitespace-nowrap"
              >
                {filteredBranches.every((b) => selectedBranchIds.has(b.id)) ? (
                  <>
                    <Square className="h-4 w-4 fill-current opacity-20" />
                    Deselect Visible ({filteredBranches.length})
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 fill-current opacity-20" />
                    Select Visible ({filteredBranches.length})
                  </>
                )}
              </button>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto max-h-[500px] custom-scrollbar p-4">
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                </div>
              ) : filteredBranches.length === 0 ? (
                <div className="text-center py-20 text-slate-500">No outlets found matching filters.</div>
              ) : (
                <div className="space-y-2">
                  {filteredBranches.map((branch) => {
                    const result = results[branch.id];
                    const isSelected = selectedBranchIds.has(branch.id);
                    
                    return (
                      <div
                        key={branch.id}
                        onClick={() => !isRunning && toggleSelectBranch(branch.id)}
                        className={`group border rounded-xl p-4 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                          isRunning ? "cursor-default" : "cursor-pointer"
                        } ${
                          isSelected
                            ? "bg-slate-900 border-indigo-500/30 hover:border-indigo-500/50 shadow-inner"
                            : "bg-slate-950/20 border-slate-800/80 hover:border-slate-700/60"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {/* Checkbox Icon */}
                          <div className={`p-1 rounded-md transition-colors ${
                            isSelected ? "text-indigo-400 bg-indigo-500/10" : "text-slate-600 hover:text-slate-400"
                          }`}>
                            {isSelected ? <CheckSquare className="h-5 w-5" /> : <Square className="h-5 w-5" />}
                          </div>

                          <div>
                            <div className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                              {branch.id} - {branch.name}
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                branch.category === "Shop" 
                                  ? "bg-blue-500/10 border-blue-500/20 text-blue-400" 
                                  : "bg-purple-500/10 border-purple-500/20 text-purple-400"
                              }`}>
                                {branch.category}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 font-mono mt-0.5">{branch.ip}</div>
                          </div>
                        </div>

                        {/* Status/Output Section */}
                        {result && (
                          <div className="flex items-center gap-3 self-end sm:self-center">
                            {result.status === "pending" && (
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" /> Pending
                              </span>
                            )}
                            {result.status === "running" && (
                              <span className="text-xs text-blue-400 flex items-center gap-1.5 font-medium">
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Executing
                              </span>
                            )}
                            {result.status === "success" && (
                              <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Success
                                {result.duration && <span className="text-[10px] text-slate-500 font-mono ml-1">({result.duration}ms)</span>}
                              </span>
                            )}
                            {result.status === "failed" && (
                              <span className="text-xs text-red-400 flex items-center gap-1 font-semibold">
                                <XCircle className="h-3.5 w-3.5" /> Error
                                {result.duration && <span className="text-[10px] text-slate-500 font-mono ml-1">({result.duration}ms)</span>}
                              </span>
                            )}

                            {/* View Output CTA */}
                            {(result.stdout || result.stderr || result.status === "failed") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveResultId(branch.id);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1"
                              >
                                <Terminal className="h-3.5 w-3.5" />
                                Output
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Terminal View Drawer Modal */}
      {activeResultId && results[activeResultId] && (() => {
        const activeRes = results[activeResultId];
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              
              {/* Modal Header */}
              <div className="bg-slate-900 px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-white text-lg flex items-center gap-2">
                    <Terminal className="h-5 w-5 text-indigo-400" />
                    Terminal: {activeRes.branchId} - {activeRes.branchName}
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">Host: {activeRes.ip} | Exit Code: {activeRes.code !== null ? activeRes.code : "N/A"}</p>
                </div>
                <button
                  onClick={() => setActiveResultId(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-700"
                >
                  Close
                </button>
              </div>

              {/* Modal Terminal Console Output */}
              <div className="flex-1 overflow-y-auto p-6 font-mono text-sm leading-relaxed custom-scrollbar bg-[#080808] flex flex-col gap-4">
                <div className="text-indigo-400">$ {command}</div>
                
                {activeRes.stdout && (
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">stdout:</div>
                    <pre className="text-emerald-400 whitespace-pre-wrap">{activeRes.stdout}</pre>
                  </div>
                )}
                
                {activeRes.stderr && (
                  <div>
                    <div className="text-xs text-red-500 uppercase font-bold tracking-wider mb-1">stderr:</div>
                    <pre className="text-red-400 whitespace-pre-wrap">{activeRes.stderr}</pre>
                  </div>
                )}

                {!activeRes.stdout && !activeRes.stderr && (
                  <div className="text-slate-500 italic">No output returned.</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

// Minimal placeholder icons to prevent compile issues
function Clock(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  );
}
