import type { ReactNode } from "react";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, TONE_CLASS, type Tone } from "@/lib/adminFormat";
import { formatClock } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

export function PageHeader({
  title,
  description,
  updatedAt,
  failed,
  onRefresh
}: {
  title: string;
  description: string;
  updatedAt: number | null;
  failed: boolean;
  onRefresh: () => void;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[24px] font-bold leading-tight">{title}</h1>
        <p className="mt-1 text-[14px] text-ash">{description}</p>
      </div>
      <div className="flex items-center gap-3 text-[13px] text-ash">
        {failed ? (
          <span className="font-semibold text-cranberry" role="status">
            데이터를 불러오지 못했어요
          </span>
        ) : updatedAt !== null ? (
          <span className="tabular-nums">{formatClock(updatedAt)} 기준</span>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          className="h-9 rounded-full border border-frost-300 bg-white px-4 font-semibold text-pine hover:bg-frost-300/40"
        >
          새로고침
        </button>
      </div>
    </header>
  );
}

export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[16px] bg-white p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Metric({ label, value, hint, tone = "neutral" }: { label: string; value: string; hint?: string; tone?: Tone }) {
  const valueColor = tone === "danger" ? "text-cranberry" : tone === "progress" ? "text-[#7A5510]" : "text-pine";
  return (
    <div className="min-w-0 rounded-[16px] bg-white p-5">
      <p className="text-[13px] font-medium text-ash">{label}</p>
      <p className={`mt-2 break-all text-[22px] font-extrabold leading-none tracking-tight tabular-nums sm:text-[28px] ${valueColor}`}>
        {value}
      </p>
      {hint !== undefined && <p className="mt-2 text-[13px] text-ash">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${TONE_CLASS[ORDER_STATUS_TONE[status]]}`}>
      {ORDER_STATUS_LABEL[status]}
    </span>
  );
}

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-[12px] bg-frost px-4 py-6 text-center text-[14px] text-ash">{children}</p>;
}
