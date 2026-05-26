export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "N/A";
    
    // Format: 14 Oct 2024, 15:30:00
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(date);
  } catch (err) {
    return dateString;
  }
}

export function getStatusColor(status: string | null | undefined): string {
  if (!status) return "bg-slate-500/20 text-slate-400 border-slate-700";
  
  const colors: Record<string, string> = {
    E: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    D: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    P: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    R: "bg-green-500/20 text-green-400 border-green-500/30",
    C: "bg-red-500/20 text-red-400 border-red-500/30",
    H: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  
  return colors[status] || "bg-slate-500/20 text-slate-400 border-slate-700";
}

export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
