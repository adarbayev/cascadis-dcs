import type { ReactNode } from "react";
import { AlertCircle, Info } from "lucide-react";

type NoticeTone = "info" | "warning" | "critical" | "sensitivity";

const toneClass: Record<NoticeTone, { border: string; icon: string; title: string }> = {
  info: { border: "border-tide/30", icon: "text-tide", title: "text-ink" },
  warning: { border: "border-amber-500/40", icon: "text-amber-700", title: "text-amber-950" },
  critical: { border: "border-red-600/40", icon: "text-red-700", title: "text-red-950" },
  sensitivity: { border: "border-violet-500/40", icon: "text-violet-700", title: "text-violet-950" },
};

export function Notice({
  title,
  children,
  tone = "info",
  role,
}: {
  title: string;
  children: ReactNode;
  tone?: NoticeTone;
  role?: "alert" | "status";
}) {
  const classes = toneClass[tone];
  const Icon = tone === "info" ? Info : AlertCircle;
  return (
    <div role={role} className={`flex items-start gap-3 border bg-paper px-4 py-3 ${classes.border}`}>
      <Icon size={17} className={`mt-0.5 shrink-0 ${classes.icon}`} strokeWidth={1.8} />
      <div className="min-w-0">
        <p className={`text-sm font-semibold ${classes.title}`}>{title}</p>
        <div className="mt-1 text-xs leading-5 text-slate-600">{children}</div>
      </div>
    </div>
  );
}
