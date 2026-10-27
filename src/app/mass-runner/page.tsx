"use client";

import { useState, useEffect, useRef } from "react";
import {
  Terminal, Play, StopCircle, RefreshCw, Search, ChevronLeft,
  CheckCircle2, XCircle, AlertCircle, Download, Sliders, CheckSquare, Square,
  Plus, Trash2, Globe, PlusCircle, X, Upload, FolderOpen, Timer, Copy, Check,
  Home, Activity
} from "lucide-react";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
  ip: string;
  category: string;
  isCustom?: boolean;
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
  authMethod?: string;
}

// Sentinels for special pipeline modes
const DEPLOY_ORACLE_SENTINEL = "__DEPLOY_COINS_ORACLE__";
const UPLOAD_FILE_SENTINEL = "__UPLOAD_FILE__";
const SETUP_COINS_DOWNLOADER_SENTINEL = "__SETUP_COINS_DOWNLOADER__";

type TemplateEntry = { label: string; command: string; description?: string };
type TemplateCategory = { id: string; label: string; icon: string; templates: TemplateEntry[] };

const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: "oracle",
    label: "Oracle / DB",
    icon: "🗄️",
    templates: [
      {
        label: "Oracle Health Check",
        description: "Status, open mode, blocked sessions, corrupt blocks, tablespace usage",
        command: `sudo su - oracle -c "printf 'SET PAGESIZE 0 FEEDBACK OFF VERIFY OFF HEADING OFF ECHO OFF;\\nSELECT '\\''Status='\\'' || status FROM v\\$instance;\\nSELECT '\\''OpenMode='\\'' || open_mode FROM v\\$database;\\nSELECT '\\''BlockedSessions='\\'' || COUNT(*) FROM v\\$session WHERE blocking_session IS NOT NULL;\\nSELECT '\\''CorruptBlocks='\\'' || COUNT(*) FROM v\\$database_block_corruption;\\nSELECT '\\''TablespacesWarning='\\'' || COUNT(*) FROM (SELECT tablespace_name, ROUND((bytes - free_bytes) / bytes * 100) pct FROM (SELECT tablespace_name, SUM(bytes) bytes FROM dba_data_files GROUP BY tablespace_name) JOIN (SELECT tablespace_name, SUM(bytes) free_bytes FROM dba_free_space GROUP BY tablespace_name) USING (tablespace_name)) WHERE pct > 90;\\nEXIT;\\n' | sqlplus -s / as sysdba" | awk NF | paste -sd ", "`
      },
      {
        label: "Oracle status",
        description: "Check Oracle connectivity (system/dbsys) and grep ORA errors",
        command: `OUTPUT=$(echo -e "WHENEVER SQLERROR EXIT FAILURE;\\nWHENEVER OSERROR EXIT FAILURE;\\nCONNECT system/dbsys;\\nEXIT;" | sqlplus -S /nolog 2>&1) && echo "oracle valid" || (echo "$OUTPUT" | grep -E "ORA-[0-9]+" || echo "failed: $OUTPUT")`
      },
      {
        label: "Clear Old Offline Dumps",
        description: "Delete .dump files older than current session in /coins/zyncdump/",
        command: "sudo find /coins/zyncdump/ -type f -name '*.dump' -print -delete | wc -l"
      },
    ],
  },
  {
    id: "system",
    label: "System / Hardware",
    icon: "🖥️",
    templates: [
      {
        label: "HDD Health (SMART)",
        description: "Overall health, power-on hours, reallocated sectors, pending sectors",
        command: `sudo smartctl -a /dev/sda | awk '/SMART overall-health/ {h=$NF} /Power_On_Hours/ {p=$10} /Reallocated_Sector_Ct/ {r=$10} /Current_Pending_Sector/ {c=$10} END {print "Health=" h ", Power_On_Hours=" p ", Reallocated_Sectors=" r ", Current_Pending=" c}'`
      },
      {
        label: "Disk Usage",
        description: "Root partition disk usage",
        command: "df -h /"
      },
      {
        label: "Memory Usage",
        description: "Free and used memory summary",
        command: "free -h"
      },
      {
        label: "CPU Load",
        description: "1/5/15-minute load averages",
        command: "uptime | awk -F'load average:' '{print $2}'"
      },
      {
        label: "Zabbix Agent Status",
        description: "Check if zabbix-agent2 service is active",
        command: "sudo systemctl is-active zabbix-agent2.service"
      },
    ],
  },
  {
    id: "security",
    label: "Security / SSH",
    icon: "🔐",
    templates: [
      {
        label: "SSL Cert Status",
        description: "Check if /etc/ca/ contains exactly 2 cert files",
        command: "[ $(sudo ls /etc/ca/ | wc -l) -eq 2 ] && echo 'valid' || echo 'invalid'"
      },
      {
        label: "SSH Authorized Keys Count",
        description: "Count authorized_keys entries for the zync user",
        command: "sudo cat /home/zync/.ssh/authorized_keys | wc -l"
      },
      {
        label: "Active SSH Sessions",
        description: "List currently logged-in SSH users",
        command: "who"
      },
      {
        label: "Last 10 Failed SSH Logins",
        description: "Recent failed login attempts from auth log",
        command: "sudo grep 'Failed password' /var/log/auth.log | tail -10"
      },
    ],
  },
  {
    id: "network",
    label: "Network",
    icon: "🌐",
    templates: [
      {
        label: "Default Gateway",
        description: "Show the default route / gateway",
        command: "ip route show default"
      },
      {
        label: "Listening Ports",
        description: "All TCP/UDP ports currently listening",
        command: "sudo ss -tulnp"
      },
    ],
  },
  {
    id: "servers",
    label: "Servers",
    icon: "🖨️",
    templates: [
      {
        label: "COINS Service Status",
        description: "Check if the main COINS application service is running",
        command: "sudo systemctl is-active coins.service"
      },
      {
        label: "Zync Process Check",
        description: "Check if zync sync process is running",
        command: "pgrep -a zync || echo 'not running'"
      },
    ],
  },
  {
    id: "Till",
    label: "Till",
    icon: "🖨️",
    templates: [
      {
        label: "Setup COINS Downloader",
        description: "Upload deshanr key, coinsDumpDownloader & setupCoinsDownloader.sh → /coins → chmod +x → sudo /coins/setupCoinsDownloader.sh",
        command: SETUP_COINS_DOWNLOADER_SENTINEL,
      },
      {
        label: "Oracle db - user unlock",
        description: "Unlock system and sys accounts and set password to abc123",
        command: `sudo su - oracle -c "echo -e 'connect / as sysdba\\nalter user system identified by abc123 account unlock;\\nalter user sys identified by abc123 account unlock;\\nexit;' | sqlplus /nolog"`
      },
      {
        label: "Offline - Database status",
        description: "Check if zync sync process is running",
        command: "pgrep -a zync || echo 'not running'"
      },
    ],
  },
  {
    id: "deploy",
    label: "Deploy / Install",
    icon: "🚀",
    templates: [
      {
        label: "Install Oracle (COINS)",
        description: "SCP coinsInstallOracle → chmod +x → sudo bash on the target server",
        command: DEPLOY_ORACLE_SENTINEL,
      },
      {
        label: "Upload File to Server",
        description: "SCP any file from your machine to /home/deshanr on the target server",
        command: UPLOAD_FILE_SENTINEL,
      },
    ],
  },
  {
    id: "misc",
    label: "Custom / Misc",
    icon: "⚡",
    templates: [
      { label: "Custom Bash Command", description: "Enter any bash command below", command: "" },
    ],
  },
];

// Robust IP & Hostname Parser
function parseCustomIpInput(text: string): { ip: string; name: string }[] {
  if (!text.trim()) return [];

  const lines = text.split(/[\n,;]+/);
  const results: { ip: string; name: string }[] = [];

  lines.forEach((line) => {
    let trimmed = line.trim();
    if (!trimmed) return;

    // Remove http://, https://, ssh:// if pasted
    trimmed = trimmed.replace(/^(?:https?|ssh):\/\//i, "");

    // 1. Match IPv4 address (e.g. 192.168.1.50)
    const ipMatch = trimmed.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
    if (ipMatch) {
      const ip = ipMatch[0];
      let name = trimmed.replace(ip, "").replace(/^[\s\-:\/]+/, "").replace(/[\s\-:\/]+$/, "").trim();
      results.push({
        ip,
        name: name || `Custom IP`
      });
      return;
    }

    // 2. Match host:port or simple hostname/IP token
    const token = trimmed.split(/[\s,:]+/)[0];
    if (token && (token.includes(".") || token.toLowerCase() === "localhost")) {
      const cleanIp = token.split(":")[0];
      let name = trimmed.replace(token, "").replace(/^[\s\-:\/]+/, "").replace(/[\s\-:\/]+$/, "").trim();
      results.push({
        ip: cleanIp,
        name: name || `Custom IP`
      });
    }
  });

  return results;
}

export default function MassRunnerPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [customBranches, setCustomBranches] = useState<Branch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"All" | "Shop" | "Warehouse" | "Custom">("All");
  const [loading, setLoading] = useState(true);

  // Custom IP modal state
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customIpInput, setCustomIpInput] = useState("");
  const [notification, setNotification] = useState<string | null>(null);

  // Selection
  const [selectedBranchIds, setSelectedBranchIds] = useState<Set<string>>(new Set());

  // Execution Config
  const [command, setCommand] = useState("df -h /");
  const [concurrency, setConcurrency] = useState(10);
  const [deployMode, setDeployMode] = useState(false);
  const [uploadMode, setUploadMode] = useState(false);
  const [setupDownloaderMode, setSetupDownloaderMode] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadRemoteDir, setUploadRemoteDir] = useState("/home/deshanr");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Template category selector
  const [selectedCategoryId, setSelectedCategoryId] = useState(TEMPLATE_CATEGORIES[0].id);
  const [selectedTemplateCmd, setSelectedTemplateCmd] = useState("");

  // Run State
  const [results, setResults] = useState<Record<string, RunResult>>({});
  const [isRunning, setIsRunning] = useState(false);
  const stopFlag = useRef(false);

  // Selected result for detail view modal
  const [activeResultId, setActiveResultId] = useState<string | null>(null);
  const [copiedOutput, setCopiedOutput] = useState(false);

  // Load custom IPs from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("idt_mass_runner_custom_ips");
      if (saved) {
        const parsed: Branch[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCustomBranches(parsed);
        }
      }
    } catch (err) {
      console.error("Failed to load custom IPs from localStorage:", err);
    }
  }, []);

  // Fetch DB branches
  useEffect(() => {
    fetch("/api/branches")
      .then((res) => res.json())
      .then((data) => {
        if (data.branches) {
          setBranches(data.branches);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load branches:", err);
        setLoading(false);
      });
  }, []);

  const saveCustomBranches = (list: Branch[]) => {
    setCustomBranches(list);
    try {
      localStorage.setItem("idt_mass_runner_custom_ips", JSON.stringify(list));
    } catch (err) {
      console.error("Failed to save custom IPs to localStorage:", err);
    }
  };

  const parsedPreviewTargets = parseCustomIpInput(customIpInput);

  const parseAndAddCustomIps = () => {
    if (parsedPreviewTargets.length === 0) return;

    const existingIds = new Set([...branches.map((b) => b.id), ...customBranches.map((b) => b.id)]);
    const newTargets: Branch[] = [];

    parsedPreviewTargets.forEach((item, index) => {
      let baseId = `CUST-${item.ip.replace(/[^a-zA-Z0-9]/g, "")}`;
      let uniqueId = baseId;
      let counter = 1;

      while (existingIds.has(uniqueId)) {
        uniqueId = `${baseId}-${counter++}`;
      }
      existingIds.add(uniqueId);

      newTargets.push({
        id: uniqueId,
        name: item.name,
        ip: item.ip,
        category: "Custom",
        isCustom: true
      });
    });

    if (newTargets.length > 0) {
      const updated = [...customBranches, ...newTargets];
      saveCustomBranches(updated);

      // Auto select newly added custom targets
      setSelectedBranchIds((prev) => {
        const next = new Set(prev);
        newTargets.forEach((t) => next.add(t.id));
        return next;
      });

      // Switch category filter to "Custom" and reset search so user IMMEDIATELY sees new targets!
      setCategoryFilter("Custom");
      setSearchQuery("");

      setNotification(`Successfully added ${newTargets.length} custom target IP(s).`);
      setTimeout(() => setNotification(null), 4000);
    }

    setCustomIpInput("");
    setIsCustomModalOpen(false);
  };

  const removeCustomBranch = (id: string) => {
    const updated = customBranches.filter((b) => b.id !== id);
    saveCustomBranches(updated);
    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const clearAllCustomBranches = () => {
    const customIds = new Set(customBranches.map((b) => b.id));
    saveCustomBranches([]);
    setSelectedBranchIds((prev) => {
      const next = new Set(prev);
      customIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const allTargets = [...branches, ...customBranches];

  const filteredBranches = allTargets.filter((b) => {
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

    const targets = allTargets.filter((b) => selectedBranchIds.has(b.id));

    // Initialize/Reset results for selected targets
    const initialResults: Record<string, RunResult> = { ...results };
    targets.forEach((b) => {
      initialResults[b.id] = {
        branchId: b.id,
        branchName: b.name,
        ip: b.ip,
        status: "pending",
        stdout: "",
        stderr: "",
        code: null
      };
    });
    setResults(initialResults);

    let index = 0;

    const executeNext = async () => {
      if (stopFlag.current || index >= targets.length) return;

      const target = targets[index++];

      // Update state to running
      setResults((prev) => ({
        ...prev,
        [target.id]: { ...prev[target.id], status: "running" }
      }));

      const startTime = Date.now();
      try {
        const res = await fetch("/api/diagnostics/mass-runner/cmd", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip: target.ip, command: command.trim() })
        });

        const data = await res.json();
        const duration = Date.now() - startTime;

        if (data.error) {
          setResults((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              status: "failed",
              stderr: data.error + (data.details ? `\nDetails: ${data.details}` : ""),
              duration,
              authMethod: data.authMethod || "Failed"
            }
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              status: data.code === 0 ? "success" : "failed",
              stdout: data.stdout || "",
              stderr: data.stderr || "",
              code: data.code,
              duration,
              authMethod: data.authMethod || "N/A"
            }
          }));
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        setResults((prev) => ({
          ...prev,
          [target.id]: {
            ...prev[target.id],
            status: "failed",
            stderr: err.message || "Network request failed",
            duration,
            authMethod: "Failed"
          }
        }));
      }

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

  // Deploy pipeline: SCP + chmod + exec via dedicated endpoint
  const startDeployRun = async () => {
    if (selectedBranchIds.size === 0 || isRunning) return;

    setIsRunning(true);
    stopFlag.current = false;

    const targets = allTargets.filter((b) => selectedBranchIds.has(b.id));

    const initialResults: Record<string, RunResult> = { ...results };
    targets.forEach((b) => {
      initialResults[b.id] = {
        branchId: b.id,
        branchName: b.name,
        ip: b.ip,
        status: "pending",
        stdout: "",
        stderr: "",
        code: null,
      };
    });
    setResults(initialResults);

    let index = 0;

    const executeNext = async () => {
      if (stopFlag.current || index >= targets.length) return;

      const target = targets[index++];

      setResults((prev) => ({
        ...prev,
        [target.id]: { ...prev[target.id], status: "running" },
      }));

      const startTime = Date.now();
      try {
        const res = await fetch("/api/diagnostics/mass-runner/deploy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip: target.ip }),
        });

        const data = await res.json();
        const duration = Date.now() - startTime;

        // Build a per-step log for stdout
        const stepsLog = Array.isArray(data.steps)
          ? data.steps
            .map((s: any) => [
              `▸ [${s.step.toUpperCase()}]`,
              s.stdout ? s.stdout.trim() : "",
              s.stderr ? `STDERR: ${s.stderr.trim()}` : "",
            ]
              .filter(Boolean)
              .join("\n"))
            .join("\n\n")
          : "";

        if (data.error) {
          setResults((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              status: "failed",
              stdout: stepsLog,
              stderr: data.error + (data.details ? `\nDetails: ${data.details}` : ""),
              duration,
              authMethod: data.authMethod || "Failed",
            },
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              status: data.code === 0 ? "success" : "failed",
              stdout: stepsLog,
              stderr: data.stderr || "",
              code: data.code,
              duration,
              authMethod: data.authMethod || "N/A",
            },
          }));
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        setResults((prev) => ({
          ...prev,
          [target.id]: {
            ...prev[target.id],
            status: "failed",
            stderr: err.message || "Network request failed",
            duration,
            authMethod: "Failed",
          },
        }));
      }

      await executeNext();
    };

    const pools = [];
    const poolCount = Math.min(concurrency, targets.length);
    for (let i = 0; i < poolCount; i++) {
      pools.push(executeNext());
    }

    await Promise.all(pools);
    setIsRunning(false);
  };

  // Upload-only pipeline: SCP file from browser to remote server
  const startUploadRun = async () => {
    if (!uploadFile || selectedBranchIds.size === 0 || isRunning) return;

    setIsRunning(true);
    stopFlag.current = false;

    const targets = allTargets.filter((b) => selectedBranchIds.has(b.id));

    const initialResults: Record<string, RunResult> = { ...results };
    targets.forEach((b) => {
      initialResults[b.id] = {
        branchId: b.id,
        branchName: b.name,
        ip: b.ip,
        status: "pending",
        stdout: "",
        stderr: "",
        code: null,
      };
    });
    setResults(initialResults);

    let index = 0;

    const executeNext = async () => {
      if (stopFlag.current || index >= targets.length) return;

      const target = targets[index++];
      setResults((prev) => ({ ...prev, [target.id]: { ...prev[target.id], status: "running" } }));

      const startTime = Date.now();
      try {
        const formData = new FormData();
        formData.append("ip", target.ip);
        formData.append("file", uploadFile);
        formData.append("remoteDir", uploadRemoteDir);

        const res = await fetch("/api/diagnostics/mass-runner/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        const duration = Date.now() - startTime;

        if (data.error) {
          setResults((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              status: "failed",
              stderr: data.error + (data.details ? `\nDetails: ${data.details}` : ""),
              duration,
              authMethod: data.authMethod || "Failed",
            },
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              status: "success",
              stdout: data.stdout || `Uploaded to ${data.remotePath}`,
              stderr: "",
              code: 0,
              duration,
              authMethod: data.authMethod || "N/A",
            },
          }));
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        setResults((prev) => ({
          ...prev,
          [target.id]: {
            ...prev[target.id],
            status: "failed",
            stderr: err.message || "Network request failed",
            duration,
            authMethod: "Failed",
          },
        }));
      }

      await executeNext();
    };

    const pools = [];
    const poolCount = Math.min(concurrency, targets.length);
    for (let i = 0; i < poolCount; i++) pools.push(executeNext());
    await Promise.all(pools);
    setIsRunning(false);
  };

  // Setup COINS Downloader on Till pipeline
  const startSetupDownloaderRun = async () => {
    if (selectedBranchIds.size === 0 || isRunning) return;

    setIsRunning(true);
    stopFlag.current = false;

    const targets = allTargets.filter((b) => selectedBranchIds.has(b.id));

    const initialResults: Record<string, RunResult> = { ...results };
    targets.forEach((b) => {
      initialResults[b.id] = {
        branchId: b.id,
        branchName: b.name,
        ip: b.ip,
        status: "pending",
        stdout: "",
        stderr: "",
        code: null,
      };
    });
    setResults(initialResults);

    let index = 0;

    const executeNext = async () => {
      if (stopFlag.current || index >= targets.length) return;

      const target = targets[index++];

      setResults((prev) => ({
        ...prev,
        [target.id]: { ...prev[target.id], status: "running" },
      }));

      const startTime = Date.now();
      try {
        const res = await fetch("/api/diagnostics/mass-runner/setup-coins-downloader", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ip: target.ip }),
        });

        const data = await res.json();
        const duration = Date.now() - startTime;

        const stepsLog = Array.isArray(data.steps)
          ? data.steps
            .map((s: any) => [
              `▸ [${s.step.toUpperCase()}]`,
              s.stdout ? s.stdout.trim() : "",
              s.stderr ? `STDERR: ${s.stderr.trim()}` : "",
            ]
              .filter(Boolean)
              .join("\n"))
            .join("\n\n")
          : "";

        const displayOutput = data.stdout || stepsLog || "";

        if (data.error) {
          setResults((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              status: "failed",
              stdout: displayOutput,
              stderr: data.error + (data.details ? `\nDetails: ${data.details}` : ""),
              duration,
              authMethod: data.authMethod || "Failed",
            },
          }));
        } else {
          setResults((prev) => ({
            ...prev,
            [target.id]: {
              ...prev[target.id],
              status: data.code === 0 ? "success" : "failed",
              stdout: displayOutput,
              stderr: data.stderr || "",
              code: data.code,
              duration,
              authMethod: data.authMethod || "N/A",
            },
          }));
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        setResults((prev) => ({
          ...prev,
          [target.id]: {
            ...prev[target.id],
            status: "failed",
            stderr: err.message || "Network request failed",
            duration,
            authMethod: "Failed",
          },
        }));
      }

      await executeNext();
    };

    const pools = [];
    const poolCount = Math.min(concurrency, targets.length);
    for (let i = 0; i < poolCount; i++) {
      pools.push(executeNext());
    }

    await Promise.all(pools);
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
      ["Target ID", "Target Name", "IP Address", "Category", "Auth Method", "Status", "Exit Code", "Duration (ms)", "Stdout", "Stderr"]
    ];

    Object.values(results).forEach((r) => {
      if (selectedBranchIds.has(r.branchId)) {
        const targetObj = allTargets.find((t) => t.id === r.branchId);
        csvRows.push([
          r.branchId,
          r.branchName,
          r.ip,
          targetObj?.category || "Unknown",
          r.authMethod || "N/A",
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
    <div className="flex flex-col gap-6 min-h-[calc(100vh-6rem)] animate-in fade-in duration-500 pb-16">

      {/* Toast Notification Banner */}
      {notification && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-emerald-950/20 animate-in slide-in-from-top-2 backdrop-blur-md">
          <div className="flex items-center gap-2.5 text-sm font-semibold">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            {notification}
          </div>
          <button onClick={() => setNotification(null)} className="text-emerald-400 hover:text-white p-1 rounded-lg transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div
        className="rounded-2xl border border-white/[0.08] p-6 flex flex-col md:flex-row md:items-center justify-between gap-5"
        style={{
          background: "rgba(15,23,42,0.6)",
          backdropFilter: "blur(14px)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
        }}
      >
        <div className="flex items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 shadow-md shadow-indigo-500/20 text-white">
                <Terminal className="h-5 w-5" />
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white">
                Mass Command Runner
              </h1>
            </div>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Parallel administration, safe diagnostic audits, and deployment pipelines across multi-node infrastructure.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Target badges */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-slate-400">
            <span>Targets: <strong className="text-white">{allTargets.length}</strong></span>
            <span className="text-slate-600">·</span>
            <span>Selected: <strong className="text-indigo-400">{selectedBranchIds.size}</strong></span>
          </div>

          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="group px-4 py-1 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all duration-200 active:scale-95 flex items-center gap-2 shadow-lg"
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #2373f5ff 100%)",
              boxShadow: "0 4px 14px rgba(79,70,229,0.35)",
            }}
          >
            <PlusCircle className="h-4 w-4 transition-transform group-hover:rotate-90 duration-300" />
            <span>Add Custom IPs</span>
            {customBranches.length > 0 && (
              <span className="bg-white/20 text-white px-2 py-0.5 rounded-full text-xs font-bold font-mono">
                {customBranches.length}
              </span>
            )}
          </button>

          {completedCount > 0 && (
            <button
              onClick={exportToCSV}
              className="bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2"
            >
              <Download className="h-4 w-4 text-emerald-400" />
              <span>Export CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress & Live Execution Ribbon */}
      {(isRunning || completedCount > 0) && (
        <div
          className="rounded-2xl border border-white/[0.08] p-5 flex flex-col gap-4 animate-in slide-in-from-top-3"
          style={{
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(14px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isRunning ? "bg-blue-400 animate-pulse" : "bg-emerald-400"}`} />
              <span className="text-sm font-bold text-white">
                {isRunning ? "Parallel Execution in Progress..." : "Execution Finished"}
              </span>
            </div>
            <span className="font-mono text-xs text-slate-400">
              Completed <strong className="text-white">{completedCount}</strong> of <strong className="text-white">{totalSelected}</strong> ({progressPercent}%)
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full bg-white/[0.06] rounded-full overflow-hidden p-0.5">
            <div
              className="h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-400"
              style={{
                width: `${progressPercent}%`,
                boxShadow: "0 0 10px rgba(99,102,241,0.5)",
              }}
            />
          </div>

          {/* Status metrics grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-950/60 border border-white/[0.06] p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Success</div>
                <div className="font-bold text-emerald-400 text-base font-mono">{successCount}</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-500/40" />
            </div>
            <div className="bg-slate-950/60 border border-white/[0.06] p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Failed</div>
                <div className="font-bold text-rose-400 text-base font-mono">{failedCount}</div>
              </div>
              <XCircle className="h-5 w-5 text-rose-500/40" />
            </div>
            <div className="bg-slate-950/60 border border-white/[0.06] p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">In-Flight</div>
                <div className="font-bold text-blue-400 text-base font-mono animate-pulse">{runningCount}</div>
              </div>
              <RefreshCw className="h-5 w-5 text-blue-500/40 animate-spin" />
            </div>
            <div className="bg-slate-950/60 border border-white/[0.06] p-3 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-semibold text-slate-500">Selected</div>
                <div className="font-bold text-slate-200 text-base font-mono">{totalSelected}</div>
              </div>
              <Timer className="h-5 w-5 text-slate-500/40" />
            </div>
          </div>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Left Column: Command & Pipeline Setup (5 of 12 cols) */}
        <div
          className="lg:col-span-5 rounded-2xl border border-white/[0.08] p-5 sm:p-6 flex flex-col gap-6"
          style={{
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(14px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-indigo-400" />
              Command Configuration
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              {concurrency} threads
            </span>
          </div>

          {/* 1. Categorized Template Picker */}
          <div className="space-y-3">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Command Presets</span>
              <span className="text-slate-500 lowercase font-normal">choose category below</span>
            </label>

            {/* Category tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-950/60 border border-white/[0.04]">
              {TEMPLATE_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSelectedCategoryId(cat.id);
                    setSelectedTemplateCmd("");
                  }}
                  title={cat.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedCategoryId === cat.id
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>

            {/* Template dropdown for selected category */}
            {(() => {
              const cat = TEMPLATE_CATEGORIES.find((c) => c.id === selectedCategoryId)!;
              return (
                <div className="flex flex-col gap-2">
                  <select
                    value={selectedTemplateCmd}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedTemplateCmd(val);
                      if (val === DEPLOY_ORACLE_SENTINEL) {
                        setDeployMode(true);
                        setUploadMode(false);
                        setSetupDownloaderMode(false);
                        setCommand("[Deploy: SCP coinsInstallOracle \u2192 chmod +x \u2192 sudo bash]");
                      } else if (val === UPLOAD_FILE_SENTINEL) {
                        setUploadMode(true);
                        setDeployMode(false);
                        setSetupDownloaderMode(false);
                        setCommand("[Upload file to /home/deshanr on each server]");
                      } else if (val === SETUP_COINS_DOWNLOADER_SENTINEL) {
                        setSetupDownloaderMode(true);
                        setDeployMode(false);
                        setUploadMode(false);
                        setCommand("[Till Setup: SCP deshanr_key & setupCoinsDownloader.sh \u2192 /coins \u2192 chmod +x \u2192 sudo /coins/setupCoinsDownloader.sh]");
                      } else {
                        setDeployMode(false);
                        setUploadMode(false);
                        setSetupDownloaderMode(false);
                        if (val !== "") setCommand(val);
                      }
                    }}
                    className="w-full bg-slate-950/80 border border-white/[0.08] rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors"
                    disabled={isRunning}
                  >
                    <option value="">— Select a preset template ({cat.label}) —</option>
                    {cat.templates.map((tmpl) => (
                      <option key={tmpl.label} value={tmpl.command}>
                        {tmpl.label}
                      </option>
                    ))}
                  </select>

                  {/* Description chip */}
                  {selectedTemplateCmd !== "" && (() => {
                    const desc = cat.templates.find((t) => t.command === selectedTemplateCmd)?.description;
                    return desc ? (
                      <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300">
                        {desc}
                      </div>
                    ) : null;
                  })()}
                </div>
              );
            })()}
          </div>

          {/* Special Pipeline Banners */}
          {deployMode && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col gap-1.5">
              <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <span>🚀</span> Deploy Pipeline Active
              </p>
              <p className="text-[11px] text-amber-400/80 leading-relaxed font-mono">
                SCP coinsInstallOracle → chmod +x → sudo bash on each target.
              </p>
            </div>
          )}

          {setupDownloaderMode && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex flex-col gap-1.5">
              <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                <span>⚡</span> Till Downloader Setup Active
              </p>
              <p className="text-[11px] text-emerald-400/80 leading-relaxed font-mono">
                SCP deshanr key & setup script → /coins → chmod +x → execute on Till.
              </p>
            </div>
          )}

          {/* Upload Mode file picker */}
          {uploadMode && (
            <div className="bg-sky-500/10 border border-sky-500/30 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                <Upload className="h-3.5 w-3.5" /> Upload File Target
              </p>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-3 bg-slate-950 border border-white/[0.08] rounded-xl px-3.5 py-3 cursor-pointer hover:border-sky-500/60 transition-colors"
              >
                <FolderOpen className="h-4 w-4 text-slate-500 shrink-0" />
                <span className={`text-xs truncate ${uploadFile ? "text-sky-300 font-medium" : "text-slate-500"}`}>
                  {uploadFile ? uploadFile.name : "Click to select local file..."}
                </span>
                {uploadFile && (
                  <span className="ml-auto text-[10px] font-mono text-slate-400 shrink-0">
                    {(uploadFile.size / 1024).toFixed(1)} KB
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
              />

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Remote Destination</label>
                <input
                  type="text"
                  value={uploadRemoteDir}
                  onChange={(e) => setUploadRemoteDir(e.target.value)}
                  className="bg-slate-950 border border-white/[0.08] rounded-xl px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-sky-500"
                  placeholder="/home/deshanr"
                  disabled={isRunning}
                />
              </div>
            </div>
          )}

          {/* 2. Command Code Input (when not in deploy/upload mode) */}
          {!deployMode && !uploadMode && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Terminal Command Payload
                </label>
                <button
                  type="button"
                  onClick={() => setCommand("")}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="relative font-mono text-sm bg-black/70 border border-white/[0.08] rounded-xl overflow-hidden focus-within:border-indigo-500 transition-colors shadow-inner">
                <div className="px-3.5 py-1.5 bg-white/[0.03] border-b border-white/[0.06] flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>bash script</span>
                  <span>stdin</span>
                </div>
                <div className="flex items-start p-3">
                  <span className="text-indigo-400 font-bold mr-2 mt-0.5">$</span>
                  <textarea
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    placeholder="Enter bash command (e.g., uptime, df -h, free -m)..."
                    className="w-full bg-transparent border-none outline-none focus:ring-0 p-0 text-slate-200 font-mono text-xs sm:text-sm min-h-[95px] custom-scrollbar"
                    disabled={isRunning}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Concurrency Slider */}
          <div className="space-y-2 bg-slate-950/40 p-3.5 rounded-xl border border-white/[0.04]">
            <div className="flex justify-between items-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Concurrency Limit</span>
              <span className="font-mono text-indigo-400 px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/20">
                {concurrency} Threads
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="30"
              value={concurrency}
              onChange={(e) => setConcurrency(parseInt(e.target.value))}
              disabled={isRunning}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-slate-600 font-mono">
              <span>1 Node (Sequential)</span>
              <span>15 Nodes</span>
              <span>30 Nodes (Max Parallel)</span>
            </div>
          </div>

          {/* 4. Action Trigger Button */}
          <div className="pt-1">
            {isRunning ? (
              <button
                onClick={stopExecution}
                className="w-full bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 border border-red-500 shadow-[0_0_20px_rgba(220,38,38,0.3)] active:scale-95"
              >
                <StopCircle className="h-5 w-5" />
                <span>Stop Execution Immediately</span>
              </button>
            ) : deployMode ? (
              <button
                onClick={startDeployRun}
                disabled={selectedBranchIds.size === 0}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 border border-amber-500 shadow-[0_4px_18px_rgba(217,119,6,0.35)] active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Deploy to {selectedBranchIds.size} Server{selectedBranchIds.size !== 1 ? "s" : ""}</span>
              </button>
            ) : uploadMode ? (
              <button
                onClick={startUploadRun}
                disabled={selectedBranchIds.size === 0 || !uploadFile}
                className="w-full bg-gradient-to-r from-sky-600 to-blue-600 hover:brightness-110 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 border border-sky-500 shadow-[0_4px_18px_rgba(14,165,233,0.35)] active:scale-95"
              >
                <Upload className="h-4 w-4" />
                <span>Upload to {selectedBranchIds.size} Server{selectedBranchIds.size !== 1 ? "s" : ""}</span>
              </button>
            ) : setupDownloaderMode ? (
              <button
                onClick={startSetupDownloaderRun}
                disabled={selectedBranchIds.size === 0}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 border border-emerald-500 shadow-[0_4px_18px_rgba(16,185,129,0.35)] active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Setup Downloader on {selectedBranchIds.size} Till{selectedBranchIds.size !== 1 ? "s" : ""}</span>
              </button>
            ) : (
              <button
                onClick={startMassRun}
                disabled={selectedBranchIds.size === 0 || !command.trim()}
                className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:brightness-110 disabled:opacity-40 text-white font-bold py-3.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 border border-indigo-500 shadow-[0_4px_18px_rgba(79,70,229,0.35)] active:scale-95"
              >
                <Play className="h-4 w-4 fill-current" />
                <span>Run Command on {selectedBranchIds.size} Target{selectedBranchIds.size !== 1 ? "s" : ""}</span>
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Outlets / Targets Grid (7 of 12 cols) */}
        <div
          className="lg:col-span-7 rounded-2xl border border-white/[0.08] flex flex-col overflow-hidden shadow-xl"
          style={{
            background: "rgba(15,23,42,0.6)",
            backdropFilter: "blur(14px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.03)",
          }}
        >
          {/* Toolbar Header */}
          <div className="p-4 border-b border-white/[0.06] bg-slate-950/40 flex flex-col sm:flex-row gap-3 items-center justify-between">
            {/* Search + Category Tabs */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative w-full sm:w-56">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search name, code, or IP..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/[0.08] rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Category Pills */}
              <div className="flex border border-white/[0.06] bg-slate-950/70 rounded-xl p-0.5 overflow-hidden">
                {(["All", "Shop", "Warehouse", "Custom"] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${categoryFilter === cat
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                      }`}
                  >
                    <span>{cat === "Custom" ? "Custom" : `${cat}s`}</span>
                    {cat === "Custom" && customBranches.length > 0 && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-1.5 rounded-full">
                        {customBranches.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Selection Quick Actions */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              {customBranches.length > 0 && (
                <button
                  onClick={clearAllCustomBranches}
                  title="Clear all custom IP targets"
                  className="text-xs font-semibold text-rose-400 hover:text-rose-300 bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/20 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clear Custom</span>
                </button>
              )}

              <button
                onClick={toggleSelectAll}
                className="text-xs font-semibold flex items-center gap-1.5 text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 px-3 py-1.5 rounded-xl border border-indigo-500/25 transition-all whitespace-nowrap"
              >
                {filteredBranches.length > 0 && filteredBranches.every((b) => selectedBranchIds.has(b.id)) ? (
                  <>
                    <Square className="h-3.5 w-3.5 opacity-60" />
                    <span>Deselect ({filteredBranches.length})</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Select Visible ({filteredBranches.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Target List Body */}
          <div className="overflow-y-auto max-h-[640px] custom-scrollbar p-4 space-y-2">
            {loading ? (
              <div className="flex flex-col justify-center items-center py-24 gap-3">
                <RefreshCw className="h-8 w-8 text-indigo-400 animate-spin" />
                <span className="text-xs text-slate-500 font-mono">Loading targets from database...</span>
              </div>
            ) : filteredBranches.length === 0 ? (
              <div className="text-center py-24 text-slate-500 flex flex-col items-center gap-2.5">
                <Globe className="h-10 w-10 text-slate-700 stroke-1" />
                <span className="text-sm">No target outlets or IPs found matching filters.</span>
                {categoryFilter === "Custom" && (
                  <button
                    onClick={() => setIsCustomModalOpen(true)}
                    className="mt-2 text-xs text-indigo-400 hover:underline font-semibold"
                  >
                    + Add your first custom IP target
                  </button>
                )}
              </div>
            ) : (
              filteredBranches.map((branch) => {
                const result = results[branch.id];
                const isSelected = selectedBranchIds.has(branch.id);

                return (
                  <div
                    key={branch.id}
                    onClick={() => !isRunning && toggleSelectBranch(branch.id)}
                    className={`group border rounded-xl p-3.5 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isRunning ? "cursor-default" : "cursor-pointer"
                      } ${isSelected
                        ? "bg-slate-900/90 border-indigo-500/40 shadow-sm"
                        : "bg-slate-950/30 border-white/[0.04] hover:bg-white/[0.02] hover:border-white/[0.08]"
                      }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Checkbox Icon */}
                      <div className={`p-1 rounded-lg transition-colors ${isSelected ? "text-indigo-400 bg-indigo-500/10" : "text-slate-600 group-hover:text-slate-400"
                        }`}>
                        {isSelected ? <CheckSquare className="h-4.5 w-4.5" /> : <Square className="h-4.5 w-4.5" />}
                      </div>

                      <div className="min-w-0">
                        <div className="font-bold text-white text-xs sm:text-sm flex items-center gap-2 truncate">
                          <span className="truncate">{branch.name}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${branch.category === "Shop"
                            ? "bg-blue-500/10 border-blue-500/20 text-blue-400"
                            : branch.category === "Warehouse"
                              ? "bg-purple-500/10 border-purple-500/20 text-purple-400"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                            }`}>
                            {branch.category}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-2">
                          <span className="text-slate-300 font-medium">{branch.ip}</span>
                          <span className="text-slate-700">·</span>
                          <span className="text-slate-500">ID: {branch.id}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Output CTA */}
                    <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                      {result && (
                        <>
                          {result.status === "pending" && (
                            <span className="text-xs text-slate-500 flex items-center gap-1 font-mono bg-white/[0.02] px-2.5 py-1 rounded-lg border border-white/[0.04]">
                              <Timer className="h-3 w-3" /> Pending
                            </span>
                          )}
                          {result.status === "running" && (
                            <span className="text-xs text-blue-400 flex items-center gap-1.5 font-medium bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20 font-mono">
                              <RefreshCw className="h-3 w-3 animate-spin" /> Executing
                            </span>
                          )}
                          {result.status === "success" && (
                            <span className="text-xs text-emerald-400 flex items-center gap-1 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 font-mono">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Success
                              {result.duration && <span className="text-[10px] text-slate-500 ml-1">({result.duration}ms)</span>}
                            </span>
                          )}
                          {result.status === "failed" && (
                            <span className="text-xs text-rose-400 flex items-center gap-1 font-semibold bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20 font-mono">
                              <XCircle className="h-3.5 w-3.5" /> Failed
                              {result.duration && <span className="text-[10px] text-slate-500 ml-1">({result.duration}ms)</span>}
                            </span>
                          )}

                          {/* Output CTA */}
                          {(result.stdout || result.stderr || result.status === "failed") && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveResultId(branch.id);
                              }}
                              className="bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 border border-white/[0.08] px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 font-mono"
                            >
                              <Terminal className="h-3 w-3 text-indigo-400" />
                              Log
                            </button>
                          )}
                        </>
                      )}

                      {/* Custom target delete */}
                      {branch.isCustom && !isRunning && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomBranch(branch.id);
                          }}
                          title="Remove custom target"
                          className="text-slate-600 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Add Custom IPs Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div
            className="rounded-2xl border border-white/[0.1] w-full max-w-xl flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            style={{
              background: "rgba(15,23,42,0.95)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Globe className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-white text-base">
                  Add Custom Target IP List
                </h3>
              </div>
              <button
                onClick={() => setIsCustomModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Paste single or multiple IP addresses below (newline or comma separated).
                Labels are automatically extracted (e.g. <span className="font-mono text-slate-300">192.168.1.50 - Server 1</span>).
              </p>

              <textarea
                value={customIpInput}
                onChange={(e) => setCustomIpInput(e.target.value)}
                placeholder={"192.168.1.101\n192.168.1.102 - Till Backup\n10.0.0.50: Store Server"}
                className="w-full bg-black/60 border border-white/[0.08] rounded-xl p-4 text-xs font-mono text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors min-h-[150px] custom-scrollbar"
              />

              {parsedPreviewTargets.length > 0 ? (
                <div className="bg-indigo-500/10 border border-indigo-500/20 p-3.5 rounded-xl flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between text-indigo-300 font-medium">
                    <span>Parsed Preview:</span>
                    <span className="font-bold font-mono text-indigo-400 bg-indigo-950/80 px-2 py-0.5 rounded-md border border-indigo-500/30">
                      {parsedPreviewTargets.length} target{parsedPreviewTargets.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar text-[11px] font-mono text-slate-400">
                    {parsedPreviewTargets.slice(0, 6).map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-900/80 px-2.5 py-1 rounded border border-white/[0.04]">
                        <span className="text-indigo-400 font-bold">{item.ip}</span>
                        <span className="text-slate-400 truncate max-w-[200px]">{item.name}</span>
                      </div>
                    ))}
                    {parsedPreviewTargets.length > 6 && (
                      <div className="text-center text-slate-500 italic text-[10px]">
                        + {parsedPreviewTargets.length - 6} more targets...
                      </div>
                    )}
                  </div>
                </div>
              ) : customIpInput.trim().length > 0 ? (
                <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-xs text-amber-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>No valid IP addresses detected in text.</span>
                </div>
              ) : null}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsCustomModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={parseAndAddCustomIps}
                  disabled={parsedPreviewTargets.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:brightness-110 disabled:opacity-40 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Add {parsedPreviewTargets.length > 0 ? parsedPreviewTargets.length : ""} Target{parsedPreviewTargets.length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terminal View Drawer Modal */}
      {activeResultId && results[activeResultId] && (() => {
        const activeRes = results[activeResultId];

        const handleCopy = () => {
          const text = [
            `# Host: ${activeRes.ip} (${activeRes.branchName})`,
            `# Command: ${command}`,
            activeRes.stdout ? `\n[STDOUT]\n${activeRes.stdout}` : "",
            activeRes.stderr ? `\n[STDERR]\n${activeRes.stderr}` : "",
          ].filter(Boolean).join("\n");

          navigator.clipboard.writeText(text);
          setCopiedOutput(true);
          setTimeout(() => setCopiedOutput(false), 2000);
        };

        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div
              className="rounded-2xl border border-white/[0.1] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
              style={{
                background: "rgba(10,14,26,0.95)",
                backdropFilter: "blur(20px)",
              }}
            >
              {/* Modal Window Header */}
              <div className="px-5 py-3.5 border-b border-white/[0.06] bg-white/[0.02] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 mr-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm flex items-center gap-2">
                      <Terminal className="h-4 w-4 text-indigo-400" />
                      <span>{activeRes.branchName}</span>
                      <span className="font-mono text-xs text-slate-500 font-normal">({activeRes.ip})</span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border ${activeRes.status === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    }`}>
                    exit {activeRes.code !== null ? activeRes.code : "N/A"}
                  </span>
                  {activeRes.duration && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {activeRes.duration}ms
                    </span>
                  )}
                  <button
                    onClick={handleCopy}
                    className="p-1.5 text-slate-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] rounded-lg border border-white/[0.06] transition-colors ml-2"
                    title="Copy output to clipboard"
                  >
                    {copiedOutput ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    onClick={() => setActiveResultId(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Modal Terminal Console Output */}
              <div className="flex-1 overflow-y-auto p-5 font-mono text-xs leading-relaxed custom-scrollbar bg-black/60 flex flex-col gap-4">
                <div className="text-indigo-400 font-bold">$ {command}</div>

                {activeRes.stdout && (
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">STDOUT:</div>
                    <pre className="text-emerald-400 whitespace-pre-wrap">{activeRes.stdout}</pre>
                  </div>
                )}

                {activeRes.stderr && (
                  <div>
                    <div className="text-[10px] text-rose-400 uppercase font-bold tracking-wider mb-1">STDERR:</div>
                    <pre className="text-rose-400 whitespace-pre-wrap">{activeRes.stderr}</pre>
                  </div>
                )}

                {!activeRes.stdout && !activeRes.stderr && (
                  <div className="text-slate-500 italic">No output returned from target.</div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
