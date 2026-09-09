import type { ReactNode } from "react";
import type { RequestStatus } from "@/lib/types";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-6 py-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "positive" | "warning" | "danger";
}) {
  const tones = {
    default: { text: "text-slate-900", rail: "bg-brand-500" },
    positive: { text: "text-accent-700", rail: "bg-accent-500" },
    warning: { text: "text-amber-600", rail: "bg-amber-500" },
    danger: { text: "text-red-600", rail: "bg-red-500" },
  } as const;
  const t = tones[tone];

  return (
    <Card className="relative overflow-hidden p-5 pl-6 transition duration-200 hover:shadow-lift">
      {/* Colour rail encodes the tone without relying on the value's colour alone. */}
      <span className={cn("absolute inset-y-0 left-0 w-1", t.rail)} aria-hidden="true" />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className={cn("mt-2.5 text-2xl font-bold tabular-nums tracking-tight", t.text)}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </Card>
  );
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  APPROVED: "bg-accent-50 text-accent-700 ring-accent-600/20",
  REJECTED: "bg-red-50 text-red-700 ring-red-600/20",
};

const STATUS_DOTS: Record<RequestStatus, string> = {
  PENDING: "bg-amber-500",
  APPROVED: "bg-accent-500",
  REJECTED: "bg-red-500",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 ring-slate-500/20",
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status] ?? "bg-slate-400")}
        aria-hidden="true"
      />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

/** Horizontal capacity meter for a pool direction. */
export function UsageBar({
  label,
  usedPct,
  caption,
}: {
  label: string;
  usedPct: number;
  caption?: string;
}) {
  const pct = Math.min(100, Math.max(0, usedPct));
  const tone =
    pct >= 90
      ? "bg-gradient-to-r from-red-400 to-red-600"
      : pct >= 75
        ? "bg-gradient-to-r from-amber-400 to-amber-500"
        : "bg-gradient-to-r from-brand-500 to-accent-500";

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="font-semibold tabular-nums text-slate-500">{pct.toFixed(1)}% used</span>
      </div>
      <div
        className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200/70"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} utilisation`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", tone)}
          style={{ width: `${pct}%` }}
        />
      </div>
      {caption ? <p className="mt-2 text-xs text-slate-500">{caption}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div
        className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-400"
        aria-hidden="true"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-4l-2 3h-4l-2-3H4" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {description ? (
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorNotice({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
    >
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-red-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      <span>{message}</span>
    </div>
  );
}

/** Shared pill link style for primary actions in page headings. */
export const primaryLinkClass =
  "inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 hover:shadow-lift active:scale-[0.98]";

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "px-6 py-3.5 text-left text-[0.7rem] font-bold uppercase tracking-wider text-slate-500",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-6 py-4 text-sm text-slate-700", className)}>{children}</td>;
}
