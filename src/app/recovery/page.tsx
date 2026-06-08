"use client";

import { useState, useEffect, Suspense } from "react";
import { Terminal, ServerCrash, Play, RefreshCw, CheckCircle2, AlertCircle, ChevronRight, Search, ChevronLeft, FileWarning, ArrowLeft, Home, Wifi, WifiOff, Signal } from "lucide-react";
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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [filteredBranches, setFilteredBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [statusOutput, setStatusOutput] = useState<{ output: string; error_output: string } | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [execLoading, setExecLoading] = useState(false);
  const [execResult, setExecResult] = useState<{ output: string; error_output: string; success: boolean } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const [unsyncedLoading, setUnsyncedLoading] = useState(false);
  const [unsyncedBranches, setUnsyncedBranches] = useState<any[]>([]);
  const [showUnsynced, setShowUnsynced] = useState(false);
  const [unsyncedHours, setUnsyncedHours] = useState(3);

  const [unprocessedLoading, setUnprocessedLoading] = useState(false);
  const [unprocessedFiles, setUnprocessedFiles] = useState<any[]>([]);
  const [showUnprocessed, setShowUnprocessed] = useState(false);
  const [unprocessedMinutes, setUnprocessedMinutes] = useState(5);
  const [expandedOutlets, setExpandedOutlets] = useState<Record<string, boolean>>({});

  // Tracks where to return to when navigating back from a branch detail view
  const [returnTo, setReturnTo] = useState<null | 'unsynced' | 'unprocessed'>(null);

  // Per-branch ping state: { [branchId]: 'loading' | 'up' | 'down' }
  const [pingStates, setPingStates] = useState<Record<string, 'loading' | 'up' | 'down' | 'unknown'>>({});

  useEffect(() => {
    setLoading(true);
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


  // Auto-select branch from URL query param (for middle-click new-tab)
  useEffect(() => {
    if (branches.length === 0) return;
    const branchParam = searchParams.get('branch');
    if (branchParam && !selectedBranch) {
      const found = branches.find(b => b.id === branchParam);
      if (found) {
        handleSelectBranch(found);
        handleCheckStatus(found);
      }
    }
  }, [branches, searchParams]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFilteredBranches(branches.filter(b => b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q)));
  }, [search, branches]);

  const handleSelectBranch = (b: Branch) => {
    setSelectedBranch(b);
    setStatusOutput(null);
    setStatusError(null);
    setExecResult(null);
    setShowConfirm(false);
    setShowUnsynced(false);
    setShowUnprocessed(false);
    setReturnTo(null);
  };

  const handleCheckStatus = async (branchOverride?: Branch, preserveExecResult = false) => {
    const targetBranch = branchOverride || selectedBranch;
    if (!targetBranch) return;

    if (branchOverride) {
      // Track where to return to before clearing the list views
      if (showUnsynced) setReturnTo('unsynced');
      else if (showUnprocessed) setReturnTo('unprocessed');
      setSelectedBranch(branchOverride);
      setShowUnsynced(false);
      setShowUnprocessed(false);
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
    } catch (err: any) {
      setStatusError("Failed to check status. Network error.");
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
        setExecResult(prev => ({ ...prev!, error_output: (prev?.error_output || "") + data.error + " - " + data.details, success: false }));
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
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const msg = JSON.parse(line);
              if (msg.type === 'out') {
                setExecResult(prev => ({ ...prev!, output: prev!.output + msg.data }));
              } else if (msg.type === 'err') {
                setExecResult(prev => ({ ...prev!, error_output: prev!.error_output + msg.data }));
              } else if (msg.type === 'done') {
                handleCheckStatus(undefined, true);
              }
            } catch (e) {
              console.error("Stream parse error:", e);
            }
          }
        }
      }
    } catch (err: any) {
      setExecResult(prev => ({ ...prev!, error_output: (prev?.error_output || "") + "Failed to execute recovery. Network error.", success: false }));
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
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUnsyncedLoading(false);
    }
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
        // Auto-expand all outlets on first load
        const outlets = new Set<string>(data.unprocessed.map((f: any) => f.BRANCH_ID || f.branch_id || 'Unknown'));
        const expanded: Record<string, boolean> = {};
        outlets.forEach(o => { expanded[o] = true; });
        setExpandedOutlets(expanded);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUnprocessedLoading(false);
    }
  };


  const handlePromptRecovery = (branch: Branch) => {
    // Track where to return to before clearing the list views
    if (showUnsynced) setReturnTo('unsynced');
    else if (showUnprocessed) setReturnTo('unprocessed');
    setSelectedBranch(branch);
    setShowUnsynced(false);
    setShowUnprocessed(false);
    setStatusOutput(null);
    setStatusError(null);
    setExecResult(null);
    setShowConfirm(true);
  };

  const handleGoBack = () => {
    setSelectedBranch(null);
    setStatusOutput(null);
    setStatusError(null);
    setExecResult(null);
    setShowConfirm(false);
    if (returnTo === 'unsynced') {
      setShowUnsynced(true);
      setShowUnprocessed(false);
    } else if (returnTo === 'unprocessed') {
      setShowUnprocessed(true);
      setShowUnsynced(false);
    }
    setReturnTo(null);
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

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[85vh] animate-in fade-in duration-500">

      {/* Sidebar - Branch List */}
      <div className="w-full md:w-1/4 flex flex-col glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ServerCrash className="h-5 w-5 text-rose-400" />
            Outlets
          </h2>
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm bg-slate-800/50 hover:bg-slate-700/50 px-2 py-1 rounded"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline">Home</span>
          </button>
        </div>
        <div className="p-4 border-b border-white/10 flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => handleFetchUnsynced()}
              disabled={unsyncedLoading}
              className={`flex-1 flex justify-center items-center gap-1 py-2 rounded text-xs font-medium transition-colors border ${showUnsynced ? 'bg-blue-600/20 text-blue-400 border-blue-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-300'}`}
            >
              {unsyncedLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
              Unsynced
              {unsyncedBranches.length > 0 && <span className="ml-1 bg-blue-500/30 text-blue-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unsyncedBranches.length}</span>}
            </button>
            <button
              onClick={() => handleFetchUnprocessed()}
              disabled={unprocessedLoading}
              className={`flex-1 flex justify-center items-center gap-1 py-2 rounded text-xs font-medium transition-colors border ${showUnprocessed ? 'bg-amber-600/20 text-amber-400 border-amber-500/50' : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-300'}`}
            >
              {unprocessedLoading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <FileWarning className="h-3 w-3" />}
              Unprocessed
              {unprocessedFiles.length > 0 && <span className="ml-1 bg-amber-500/30 text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unprocessedFiles.length}</span>}
            </button>
          </div>
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
                className={`w-full text-left p-3 rounded-lg mb-1 flex items-center justify-between transition-colors ${selectedBranch?.id === branch.id ? 'bg-blue-600/20 border border-blue-500/50' : 'hover:bg-slate-800 border border-transparent'}`}
              >
                <div>
                  <div className="font-semibold text-slate-200">{branch.id}</div>
                  <div className="text-xs text-slate-400">{branch.name}</div>
                </div>
                <ChevronRight className={`h-4 w-4 ${selectedBranch?.id === branch.id ? 'text-blue-400' : 'text-slate-600'}`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Panel - Actions */}
      <div className="w-full md:w-3/4 glass-card flex flex-col">
        {!selectedBranch && !showUnsynced && !showUnprocessed ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
            <Terminal className="h-16 w-16 mb-4 opacity-20" />
            <p className="mb-8">Select a branch to manage its sync schedule</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <button
                onClick={() => handleFetchUnsynced()}
                disabled={unsyncedLoading}
                className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-6 py-3 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                {unsyncedLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                Find Unsynced Outlets
              </button>
              <button
                onClick={() => handleFetchUnprocessed()}
                disabled={unprocessedLoading}
                className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 px-6 py-3 rounded-md font-medium transition-colors flex items-center gap-2"
              >
                {unprocessedLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <FileWarning className="h-5 w-5" />}
                Unprocessed Files
              </button>
            </div>
          </div>
        ) : showUnprocessed ? (
          <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-white/10 bg-slate-900/50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                    <FileWarning className="h-6 w-6 text-amber-500" />
                    Unprocessed Sync Files
                    {unprocessedFiles.length > 0 && (
                      <span className="bg-amber-500/20 text-amber-300 text-sm font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        {unprocessedFiles.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-slate-400 text-sm">Files stuck in queue (grouped by outlet)</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFetchUnprocessed()}
                    disabled={unprocessedLoading}
                    className="text-slate-400 hover:text-white px-3 py-2 rounded transition-colors text-sm flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${unprocessedLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowUnprocessed(false)}
                    className="text-slate-400 hover:text-white px-3 py-2 rounded transition-colors text-sm flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                </div>
              </div>
              {/* Threshold control */}
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">Stuck longer than</span>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  value={unprocessedMinutes}
                  onChange={e => setUnprocessedMinutes(Number(e.target.value))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-amber-500"
                />
                <span className="text-slate-400 text-sm">minutes</span>
                <button
                  onClick={() => handleFetchUnprocessed()}
                  disabled={unprocessedLoading}
                  className="bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/30 px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {unprocessedLoading ? (
                <div className="flex justify-center items-center h-40">
                  <RefreshCw className="h-8 w-8 text-amber-400 animate-spin" />
                </div>
              ) : unprocessedFiles.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-emerald-400 gap-3">
                  <CheckCircle2 className="h-12 w-12 opacity-80" />
                  <p>No unprocessed files found!</p>
                </div>
              ) : (() => {
                // Group by outlet (BRANCH_ID)
                const grouped = unprocessedFiles.reduce((acc: Record<string, any[]>, file) => {
                  const key = file.BRANCH_ID || file.branch_id || 'Unknown';
                  if (!acc[key]) acc[key] = [];
                  acc[key].push(file);
                  return acc;
                }, {});
                return (
                  <div className="space-y-4">
                    {Object.entries(grouped).map(([outletId, files]) => (
                      <div key={outletId} className="border border-amber-500/20 rounded-lg overflow-hidden">
                        {/* Outlet header */}
                        <button
                          onClick={() => setExpandedOutlets(prev => ({ ...prev, [outletId]: !prev[outletId] }))}
                          className="w-full flex items-center justify-between p-3 bg-amber-500/10 hover:bg-amber-500/15 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <ChevronRight className={`h-4 w-4 text-amber-400 transition-transform ${expandedOutlets[outletId] ? 'rotate-90' : ''}`} />
                            <span className="font-bold text-amber-300">{outletId}</span>
                            <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2 py-0.5 rounded-full border border-amber-500/30">
                              {files.length} file{files.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </button>
                        {/* Files list */}
                        {expandedOutlets[outletId] && (
                          <div className="divide-y divide-white/5">
                            {files.map((file, i) => (
                              <div key={i} className="p-3 bg-black/30 flex flex-col gap-1">
                                <span className="font-medium text-white text-sm">{file.FILE_NAME || file.file_name || '—'}</span>
                                <div className="text-xs text-slate-500">
                                  Queue Time: <span className="text-amber-400">{new Date(file.QUEUE_TIME || file.queue_time).toLocaleString()}</span>
                                  {file.ERROR_MESSAGE || file.error_message ? (
                                    <span className="block mt-0.5 text-red-400">Error: {file.ERROR_MESSAGE || file.error_message}</span>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        ) : showUnsynced ? (
          <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">
            <div className="p-6 border-b border-white/10 bg-slate-900/50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-amber-500" />
                    Unsynced Outlets
                    {unsyncedBranches.length > 0 && (
                      <span className="bg-amber-500/20 text-amber-300 text-sm font-bold px-2.5 py-0.5 rounded-full border border-amber-500/30">
                        {unsyncedBranches.length}
                      </span>
                    )}
                  </h2>
                  <p className="text-slate-400 text-sm">Branches not synced in the last {unsyncedHours} hour{unsyncedHours !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleFetchUnsynced()}
                    disabled={unsyncedLoading}
                    className="text-slate-400 hover:text-white px-3 py-2 rounded transition-colors text-sm flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50"
                    title="Refresh"
                  >
                    <RefreshCw className={`h-4 w-4 ${unsyncedLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowUnsynced(false)}
                    className="text-slate-400 hover:text-white px-3 py-2 rounded transition-colors text-sm flex items-center gap-2 bg-slate-800/50 hover:bg-slate-700/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                </div>
              </div>
              {/* Threshold control */}
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-sm">Not synced in more than</span>
                <input
                  type="number"
                  min={0.5}
                  max={72}
                  step={0.5}
                  value={unsyncedHours}
                  onChange={e => setUnsyncedHours(Number(e.target.value))}
                  className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-sm text-white text-center focus:outline-none focus:border-blue-500"
                />
                <span className="text-slate-400 text-sm">hours</span>
                <button
                  onClick={() => handleFetchUnsynced()}
                  disabled={unsyncedLoading}
                  className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {unsyncedLoading ? (
                <div className="flex justify-center items-center h-40">
                  <RefreshCw className="h-8 w-8 text-blue-400 animate-spin" />
                </div>
              ) : unsyncedBranches.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-emerald-400 gap-3">
                  <CheckCircle2 className="h-12 w-12 opacity-80" />
                  <p>All outlets are up to date!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unsyncedBranches.map((branch) => (
                    <a
                      key={branch.id}
                      href={`/recovery?branch=${branch.id}`}
                      onClick={(e) => e.preventDefault()}
                      onAuxClick={(e) => { if (e.button === 1) { window.open(`/recovery?branch=${branch.id}`, '_blank'); } }}
                      className="block bg-black/40 border border-white/10 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-blue-500/30 transition-colors cursor-default"
                    >
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-bold text-white text-lg">{branch.id}</span>
                          <span className="text-slate-300">{branch.name}</span>
                        </div>
                        <div className="text-sm text-slate-500">
                          IP: <span className="font-mono text-slate-400">{branch.ip || "Unknown"}</span>
                        </div>
                        <div className="text-sm text-slate-500 mt-0.5">
                          Last Sync: <span className="text-amber-400">{branch.lastSyncTime ? new Date(branch.lastSyncTime).toLocaleString() : "Never"}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={(e) => { e.preventDefault(); handlePing(branch.id); }}
                          disabled={pingStates[branch.id] === 'loading'}
                          className={`px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${pingStates[branch.id] === 'up'
                            ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                            : pingStates[branch.id] === 'down'
                              ? 'bg-red-600/20 text-red-400 border border-red-500/30'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-transparent'
                            }`}
                          title={branch.ip || 'No IP'}
                        >
                          {pingStates[branch.id] === 'loading' ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : pingStates[branch.id] === 'up' ? (
                            <Wifi className="h-4 w-4" />
                          ) : pingStates[branch.id] === 'down' ? (
                            <WifiOff className="h-4 w-4" />
                          ) : (
                            <Signal className="h-4 w-4" />
                          )}
                          {pingStates[branch.id] === 'up' ? 'Online' : pingStates[branch.id] === 'down' ? 'Offline' : 'Ping'}
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); handleCheckStatus({ id: branch.id, name: branch.name, ip: branch.ip || "" }); }}
                          className="bg-slate-800 hover:bg-slate-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          <Search className="h-4 w-4" />
                          Check Sync
                        </button>
                        <button
                          onClick={(e) => { e.preventDefault(); handlePromptRecovery({ id: branch.id, name: branch.name, ip: branch.ip || "" }); }}
                          disabled={execLoading}
                          className={`bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-3 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${execLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {execLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ServerCrash className="h-4 w-4" />}
                          Recovery Script
                        </button>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex justify-between items-start">
              <div>
                {returnTo && (
                  <button
                    onClick={handleGoBack}
                    className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs mb-3 transition-colors group"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
                    Back to {returnTo === 'unsynced' ? 'Unsynced Outlets' : 'Unprocessed Files'}
                  </button>
                )}
                <h2 className="text-2xl font-bold text-white mb-1">{selectedBranch?.id} - {selectedBranch?.name}</h2>
                <p className="text-slate-400 font-mono text-sm">IP: {selectedBranch?.ip}</p>
              </div>
              <button
                onClick={() => handleCheckStatus()}
                disabled={statusLoading || execLoading}
                className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
              >
                {statusLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Check Status
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-6 overflow-y-auto">

              {statusError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex gap-3 text-red-400">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm break-all">{statusError}</p>
                </div>
              )}

              {statusOutput && (
                <div className="mb-8 animate-in slide-in-from-bottom-4 duration-300">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3">System Output (date & atq)</h3>
                  <div className="bg-black/50 border border-slate-800 rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre">
                    <span className="text-emerald-400">{statusOutput.output || 'No output'}</span>
                    {statusOutput.error_output && <span className="text-red-400 mt-2 block">{statusOutput.error_output}</span>}
                  </div>
                </div>
              )}

              <div className="mb-8 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex justify-end">
                  {!showConfirm ? (
                    <button
                      onClick={() => setShowConfirm(true)}
                      disabled={execLoading}
                      className={`bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 px-6 py-2.5 rounded-md font-medium transition-colors flex items-center gap-2 ${execLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      {execLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ServerCrash className="h-4 w-4" />}
                      {execLoading ? 'Recovery Running...' : 'Run Recovery Script'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-4 bg-rose-500/10 border border-rose-500/30 p-4 rounded-lg w-full justify-between animate-in zoom-in-95 duration-200">
                      <div className="text-sm text-rose-300">
                        <strong className="block text-rose-400 mb-1">Confirm Execution?</strong>
                        This will kill java, restart tomcat, and clear logs.
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-slate-300 hover:text-white text-sm">Cancel</button>
                        <button
                          onClick={handleExecute}
                          disabled={execLoading}
                          className="bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2"
                        >
                          {execLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                          Execute Now
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {execResult && (
                <div className="mt-8 animate-in slide-in-from-bottom-4 duration-300">
                  <h3 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    Recovery Result
                    {execResult.success ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  </h3>
                  <div className={`bg-black/50 border rounded-lg p-4 font-mono text-sm overflow-x-auto whitespace-pre ${execResult.success ? 'border-emerald-500/30' : 'border-red-500/30'}`}>
                    {execResult.output && <span className="text-emerald-400 block">{execResult.output}</span>}
                    {execResult.error_output && <span className="text-amber-400 block mt-2">{execResult.error_output}</span>}
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
    <Suspense fallback={<div className="flex items-center justify-center min-h-[50vh] text-slate-400">Loading Recovery Portal...</div>}>
      <RecoveryPageContent />
    </Suspense>
  );
}
