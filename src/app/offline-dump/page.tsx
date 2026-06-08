"use client";

import { useState, useEffect } from "react";
import { Terminal, RefreshCw, Search, HardDrive, CheckCircle2, AlertCircle, ChevronLeft, Clock, FileText, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOrg } from "@/lib/OrgContext";

interface Branch {
  id: string;
  name: string;
  ip: string;
  category: string;
}

interface DumpStatus {
  exists: boolean;
  filename: string | null;
  date: string | null;
  isHealthy: boolean;
  message: string;
}

export default function OfflineDumpPage() {
  const router = useRouter();
  const { org } = useOrg();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);

  const [tillsLoading, setTillsLoading] = useState(false);
  const [tillsError, setTillsError] = useState<string | null>(null);
  const [discoveredTills, setDiscoveredTills] = useState<string[]>([]);
  const [serverIp, setServerIp] = useState<string | null>(null);

  const [serverDumpStatus, setServerDumpStatus] = useState<DumpStatus | null>(null);
  const [serverDumpLoading, setServerDumpLoading] = useState(false);

  const [tillDumpStatuses, setTillDumpStatuses] = useState<Record<string, DumpStatus>>({});
  const [tillDumpLoading, setTillDumpLoading] = useState<Record<string, boolean>>({});

  const [tillCronjob, setTillCronjob] = useState<Record<string, string>>({});
  const [tillCronjobLoading, setTillCronjobLoading] = useState<Record<string, boolean>>({});

  // Scanner state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [outdatedBranches, setOutdatedBranches] = useState<(Branch & { statusMsg: string; date: string | null })[]>([]);

  useEffect(() => {
    fetch(`/api/branches?org=${org}`)
      .then(res => res.json())
      .then(data => {
        if (data.branches) {
          setBranches(data.branches);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [org]);

  const filteredBranches = branches.filter(b => {
    const q = search.toLowerCase();
    return b.id.toLowerCase().includes(q) || b.name.toLowerCase().includes(q);
  });

  const handleSelectBranch = (b: Branch) => {
    setSelectedBranch(b);
    setDiscoveredTills([]);
    setServerIp(null);
    setTillsError(null);
    setServerDumpStatus(null);
    setTillDumpStatuses({});
    setTillDumpLoading({});
    setTillCronjob({});
    setTillCronjobLoading({});
    discoverTills(b.id);
  };

  const discoverTills = async (branchId: string) => {
    setTillsLoading(true);
    setTillsError(null);

    try {
      const res = await fetch(`/api/offline-dump/${branchId}/tills?org=${org}`);
      const data = await res.json();

      if (data.error) {
        setTillsError(data.error + (data.details ? `: ${data.details}` : ""));
      } else {
        setServerIp(data.serverIp);
        setDiscoveredTills(data.discoveredTills || []);
        checkServerDump(branchId);
      }
    } catch (err: any) {
      setTillsError("Failed to discover tills. Network error.");
    } finally {
      setTillsLoading(false);
    }
  };

  const checkServerDump = async (branchId: string) => {
    setServerDumpLoading(true);
    try {
      const res = await fetch(`/api/offline-dump/${branchId}/status/server?org=${org}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setServerDumpStatus(data.status);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setServerDumpLoading(false);
    }
  };

  const checkTillDump = async (branchId: string, tillIp: string) => {
    setTillDumpLoading(prev => ({ ...prev, [tillIp]: true }));
    try {
      const res = await fetch(`/api/offline-dump/${branchId}/status/till?org=${org}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tillIp })
      });
      const data = await res.json();
      if (data.success) {
        setTillDumpStatuses(prev => ({ ...prev, [tillIp]: data.status }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTillDumpLoading(prev => ({ ...prev, [tillIp]: false }));
    }
  };

  const checkTillCronjob = async (branchId: string, tillIp: string) => {
    if (tillCronjob[tillIp]) {
      const updated = { ...tillCronjob };
      delete updated[tillIp];
      setTillCronjob(updated);
      return;
    }

    setTillCronjobLoading(prev => ({ ...prev, [tillIp]: true }));
    try {
      const res = await fetch(`/api/offline-dump/${branchId}/cronjob?org=${org}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tillIp })
      });
      const data = await res.json();
      if (data.success) {
        setTillCronjob(prev => ({ ...prev, [tillIp]: data.cronjob }));
      } else {
        setTillCronjob(prev => ({ ...prev, [tillIp]: data.error || 'Failed to load cronjob' }));
      }
    } catch (err) {
      console.error(err);
      setTillCronjob(prev => ({ ...prev, [tillIp]: 'Network error' }));
    } finally {
      setTillCronjobLoading(prev => ({ ...prev, [tillIp]: false }));
    }
  };

  const startScan = async () => {
    const shopsToScan = branches.filter(b => b.category === 'Shop');

    setIsScanning(true);
    setScanTotal(shopsToScan.length);
    setScanProgress(0);
    setOutdatedBranches([]);

    let completed = 0;
    const concurrencyLimit = 5;

    for (let i = 0; i < shopsToScan.length; i += concurrencyLimit) {
      // If we unmounted or stopped, we'd break here (not implemented yet)
      const chunk = shopsToScan.slice(i, i + concurrencyLimit);

      const promises = chunk.map(async (branch) => {
        try {
          const res = await fetch(`/api/offline-dump/${branch.id}/status/server?org=${org}`, { method: 'POST' });
          const data = await res.json();

          if (data.success && !data.status.isHealthy) {
            setOutdatedBranches(prev => [...prev, {
              ...branch,
              statusMsg: data.status.message || 'Missing/Outdated',
              date: data.status.date
            }]);
          } else if (data.error) {
            setOutdatedBranches(prev => [...prev, {
              ...branch,
              statusMsg: data.error,
              date: null
            }]);
          }
        } catch (err) {
          setOutdatedBranches(prev => [...prev, {
            ...branch,
            statusMsg: 'Network Error',
            date: null
          }]);
        } finally {
          completed++;
          setScanProgress(completed);
        }
      });

      await Promise.all(promises);

      if (i + concurrencyLimit < shopsToScan.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }

    setIsScanning(false);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 h-[85vh] animate-in fade-in duration-500">

      {/* Sidebar - Branch List */}
      <div className="w-full md:w-1/4 flex flex-col glass-card overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-slate-900/50 flex justify-between items-center">
          <h2 className="font-semibold text-lg flex items-center gap-2 text-blue-400">
            <HardDrive className="h-5 w-5" />
            Offline Dump
          </h2>
          <button
            onClick={() => router.push('/')}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-sm bg-slate-800/50 hover:bg-slate-700/50 px-3 py-1.5 rounded-md"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </button>
        </div>

        <div className="p-4 border-b border-white/10 bg-black/20">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search branches..."
              className="w-full bg-slate-950/50 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {loading ? (
            <div className="flex justify-center p-8"><RefreshCw className="h-6 w-6 text-blue-400 animate-spin" /></div>
          ) : filteredBranches.length === 0 ? (
            <div className="text-center p-8 text-slate-500 text-sm">No branches found.</div>
          ) : (
            <div className="space-y-1">
              {filteredBranches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => handleSelectBranch(branch)}
                  className={`w-full text-left px-4 py-3 rounded-md mb-1 transition-colors flex flex-col ${selectedBranch?.id === branch.id
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                      : 'text-slate-300 hover:bg-white/5 border border-transparent'
                    }`}
                >
                  <div className="font-medium">{branch.id}</div>
                  <div className="text-sm opacity-60 mt-0.5 truncate">{branch.name}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="w-full md:w-3/4 glass-card flex flex-col overflow-hidden">
        {!selectedBranch ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-slate-900/80 p-6 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div>
                <h2 className="text-2xl font-bold text-white">Outdated Server Scanner</h2>
                <p className="text-slate-400 text-sm mt-1">Scan all shops for missing or outdated dump files on their servers.</p>
              </div>
              <button
                onClick={startScan}
                disabled={isScanning || loading}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 whitespace-nowrap"
              >
                {isScanning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
                {isScanning ? 'Scanning...' : 'Start Full Scan'}
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto bg-black/20 custom-scrollbar">
              {(isScanning || scanProgress > 0) && (
                <div className="mb-8">
                  <div className="flex justify-between items-center mb-2 text-sm text-slate-300">
                    <span>Scan Progress</span>
                    <span className="font-mono">{scanProgress} / {scanTotal}</span>
                  </div>
                  <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all duration-300 ease-out"
                      style={{ width: `${scanTotal > 0 ? (scanProgress / scanTotal) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {outdatedBranches.length > 0 ? (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                    Outdated Servers Found
                    <span className="bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full text-xs">{outdatedBranches.length}</span>
                  </h3>

                  <div className="grid gap-3">
                    {outdatedBranches.map((branch, idx) => (
                      <button
                        key={`${branch.id}-${idx}`}
                        onClick={() => handleSelectBranch(branch)}
                        className="bg-slate-900/50 border border-slate-700/50 hover:border-blue-500/50 hover:bg-slate-800/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left transition-all"
                      >
                        <div>
                          <div className="font-bold text-white text-base">{branch.id} - {branch.name}</div>
                          <div className="text-xs opacity-60 font-mono mt-0.5">{branch.ip}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-red-400 font-medium text-sm flex items-center justify-end gap-1.5">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {branch.statusMsg}
                          </div>
                          {branch.date && <div className="text-xs text-slate-400 mt-0.5 font-mono">Found: {branch.date}</div>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (scanProgress > 0 && scanProgress === scanTotal) ? (
                <div className="flex flex-col items-center justify-center py-16 text-emerald-500">
                  <CheckCircle2 className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">All Shops are Healthy!</p>
                  <p className="text-sm opacity-80 mt-1">No outdated dumps found.</p>
                </div>
              ) : !isScanning && scanProgress === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-500 h-full">
                  <div className="bg-slate-800/50 p-6 rounded-full mb-4">
                    <Search className="h-12 w-12 text-slate-400" />
                  </div>
                  <p className="text-lg font-medium text-slate-300 mb-2">Ready to Scan</p>
                  <p className="text-sm max-w-sm text-center">Click "Start Full Scan" to check the dump status of all shops concurrently.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 h-full">
                  <RefreshCw className="h-8 w-8 text-blue-500 animate-spin mb-4" />
                  <p>Scanning servers... Please wait.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Header Area */}
            <div className="bg-slate-900/80 p-6 border-b border-slate-700/50">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedBranch.id} - {selectedBranch.name}</h2>

                  <div className="flex flex-wrap items-center gap-4 text-sm mt-3">
                    <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-md border border-white/5">
                      <Terminal className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-400">Server IP:</span>
                      <span className="text-white font-mono">{serverIp || selectedBranch.ip || 'Unknown'}</span>
                    </div>

                    {serverDumpLoading ? (
                      <div className="flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-md border border-blue-500/20">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>Checking Server...</span>
                      </div>
                    ) : serverDumpStatus ? (
                      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${serverDumpStatus.isHealthy ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                        {serverDumpStatus.isHealthy ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span className="font-medium">Server Dump:</span>
                        <span className="font-mono font-bold text-white ml-1">{serverDumpStatus.filename ? `${serverDumpStatus.date}` : 'Missing'}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <button
                  onClick={() => discoverTills(selectedBranch.id)}
                  disabled={tillsLoading}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20 whitespace-nowrap"
                >
                  {tillsLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Rescan Tills
                </button>
              </div>
            </div>

            {/* Tills Content Area */}
            <div className="flex-1 p-6 overflow-y-auto bg-black/20">

              {tillsError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex gap-3 text-red-400 animate-in slide-in-from-top-2">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <p className="text-sm break-all">{tillsError}</p>
                </div>
              )}

              {tillsLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-blue-400">
                  <RefreshCw className="h-8 w-8 animate-spin mb-4" />
                  <p className="font-medium">Scanning local network for active tills...</p>
                </div>
              ) : discoveredTills.length === 0 && !tillsError ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-900/30 rounded-2xl border border-dashed border-slate-700">
                  <AlertCircle className="h-10 w-10 mb-4 opacity-50 text-blue-400" />
                  <p className="text-lg font-medium text-slate-300">No active tills discovered</p>
                  <p className="text-sm mt-2 opacity-60 max-w-sm text-center">Tills are normally found on specific IP ranges. Verify the server IP or check if tills are powered on.</p>
                </div>
              ) : discoveredTills.length > 0 ? (
                <div className="animate-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      Discovered Till Machines
                    </h3>
                    <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full text-xs font-bold">
                      {discoveredTills.length} ONLINE
                    </span>
                  </div>

                  <div className="grid gap-6">
                    {discoveredTills.map((tillIp, index) => (
                      <div key={tillIp} className="bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden shadow-sm transition-all hover:border-slate-600">
                        {/* Till Header */}
                        <div className="bg-slate-800/40 px-5 py-4 border-b border-slate-700/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className="bg-blue-500/10 p-3 rounded-full shadow-inner">
                              <Terminal className="h-5 w-5 text-blue-400" />
                            </div>
                            <div>
                              <div className="font-bold text-white text-lg flex items-center gap-2">
                                Till {index + 1}
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                              </div>
                              <div className="text-blue-200/60 font-mono text-sm mt-0.5">{tillIp}</div>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => checkTillDump(selectedBranch.id, tillIp)}
                              disabled={tillDumpLoading[tillIp]}
                              className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 border border-slate-600"
                            >
                              {tillDumpLoading[tillIp] ? <RefreshCw className="h-4 w-4 animate-spin" /> : <HardDrive className="h-4 w-4" />}
                              Check Status
                            </button>
                            <button
                              onClick={() => checkTillCronjob(selectedBranch.id, tillIp)}
                              disabled={tillCronjobLoading[tillIp]}
                              className={`${tillCronjob[tillIp] ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'} hover:bg-indigo-500/20 border px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2`}
                            >
                              {tillCronjobLoading[tillIp] ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                              {tillCronjob[tillIp] ? 'Hide Cronjob' : 'View Cronjob'}
                            </button>
                          </div>
                        </div>

                        {/* Till Content Body */}
                        {(tillDumpStatuses[tillIp] || tillCronjob[tillIp]) && (
                          <div className="p-5 flex flex-col gap-4 bg-black/20">

                            {/* Dump Status Badge */}
                            {tillDumpStatuses[tillIp] && (
                              <div className="animate-in fade-in zoom-in-95 duration-200">
                                <h4 className="text-[10px] uppercase text-slate-500 font-bold mb-2 tracking-widest flex items-center gap-1.5">
                                  <FileText className="h-3 w-3" /> Dump File Status
                                </h4>
                                <div className={`inline-flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 rounded-lg border shadow-sm ${tillDumpStatuses[tillIp].isHealthy ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-400' : 'bg-red-950/30 border-red-500/30 text-red-400'}`}>
                                  <div className="font-bold flex items-center gap-2 text-base whitespace-nowrap">
                                    {tillDumpStatuses[tillIp].isHealthy ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                                    {tillDumpStatuses[tillIp].isHealthy ? 'HEALTHY' : 'OUTDATED OR MISSING'}
                                  </div>
                                  <div className="hidden sm:block w-px h-6 bg-current opacity-20"></div>
                                  {tillDumpStatuses[tillIp].filename ? (
                                    <div className="font-mono text-sm text-white">{tillDumpStatuses[tillIp].filename}</div>
                                  ) : (
                                    <div className="text-sm opacity-90">{tillDumpStatuses[tillIp].message}</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Cronjob Output */}
                            {tillCronjob[tillIp] && (
                              <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                                <h4 className="text-[10px] uppercase text-slate-500 font-bold mb-2 tracking-widest flex items-center gap-1.5">
                                  <Terminal className="h-3 w-3" /> Crontab Configuration
                                </h4>
                                <div className="bg-[#0c0c0c] rounded-lg border border-slate-800 shadow-inner overflow-hidden">
                                  <div className="flex items-center px-4 py-2 bg-slate-900/80 border-b border-slate-800/80">
                                    <div className="flex gap-1.5">
                                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/50"></div>
                                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/50"></div>
                                    </div>
                                    <span className="text-xs font-mono text-slate-500 ml-3">crontab -l</span>
                                  </div>
                                  <pre className="font-mono text-[13px] leading-relaxed text-slate-300 overflow-x-auto whitespace-pre-wrap p-4 custom-scrollbar">
                                    {tillCronjob[tillIp]}
                                  </pre>
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
