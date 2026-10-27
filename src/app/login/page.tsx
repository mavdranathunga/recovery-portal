"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  Server,
  CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Authentication failed");
        setLoading(false);
        return;
      }

      // Login successful - navigate to home
      window.location.href = "/";
    } catch {
      setError("Network or server connection failed");
      setLoading(false);
    }
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] flex flex-col justify-center items-center px-4 overflow-hidden selection:bg-blue-500/30 selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[650px] h-[350px] bg-blue-500/10 blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-1/4 left-1/3 w-[450px] h-[300px] bg-purple-500/10 blur-[130px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[350px] h-[250px] bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Subtle background tech grid */}
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none -z-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
          backgroundSize: "32px 32px",
        }}
      />

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        {/* Brand Icon & Heading */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 shadow-2xl shadow-blue-500/20 mb-3 relative group">
            <div className="absolute inset-0 rounded-2xl bg-blue-500/20 blur-xl group-hover:bg-blue-500/40 transition-all duration-500" />
            <ShieldCheck className="h-7 w-7 text-blue-400 relative z-10 transition-transform duration-300 group-hover:scale-105" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-1.5">
            Recovery Portal
          </h1>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-white/[0.08] text-[11px] text-slate-400 font-mono shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Centralized Infrastructure Command</span>
          </div>
        </div>

        {/* Login Glassmorphic Container */}
        <div className="glass-card p-6 sm:p-8 rounded-3xl border border-white/[0.08] relative overflow-hidden backdrop-blur-2xl shadow-2xl shadow-black/50">
          {/* Top glowing gradient border */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-start gap-2.5 animate-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Operator Username
              </label>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-blue-400 transition-colors">
                  <User className="h-4 w-4" />
                </div>
                <input
                  type="text"
                  required
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter operator username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all text-xs sm:text-sm font-medium"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Authentication Password
                </label>
              </div>
              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500 group-focus-within/input:text-blue-400 transition-colors">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-950/80 border border-white/10 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 transition-all text-xs sm:text-sm font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors focus:outline-none"
                  tabIndex={-1}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold py-2.5 rounded-xl transition-all duration-300 flex justify-center items-center gap-2 group shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-60 disabled:cursor-not-allowed border border-blue-400/20 text-xs sm:text-sm active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Authenticating Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Console</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Micro status indicator */}
          <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Server className="h-3.5 w-3.5 text-blue-400" />
              <span>Gateway Node</span>
            </span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              <span>TLS 1.3 Active</span>
            </span>
          </div>
        </div>

        {/* Legal copyright footer */}
        <div className="text-center mt-5 text-[11px] text-slate-500 font-mono">
          &copy; {new Date().getFullYear()} Recovery Portal • Centralized Operations
        </div>
      </div>
    </div>
  );
}
