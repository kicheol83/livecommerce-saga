import { ORDER_STATUS_LABEL, ORDER_STATUS_ORDER } from "@/lib/adminFormat";
import { formatCount } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { t } from "@/i18n/core";

const BAR_COLOR: Record<OrderStatus, string> = {
  AWAITING_STOCK: "#E0A526",
  AWAITING_PAYMENT: "#9AA9AD",
  PAYMENT_CONFIRMING: "#EBC166",
  CONFIRMING_STOCK: "#C9941F",
  COMPENSATING: "#E07A8C",
  COMPLETED: "#16302B",
  CANCELLED: "#C8203F"
};

export function StatusBreakdown({ counts }: { counts: Partial<Record<OrderStatus, number>> }) {
  const entries = ORDER_STATUS_ORDER.map((status) => ({ status, count: counts[status] ?? 0 }));
  const total = entries.reduce((sum, entry) => sum + entry.count, 0);

  if (total === 0) {
    return <p className="text-[14px] text-ash">{t("admin.breakdown.empty")}</p>;
  }

  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-frost" aria-hidden="true">
        {entries
          .filter((entry) => entry.count > 0)
          .map((entry) => (
            <span
              key={entry.status}
              style={{ width: `${(entry.count / total) * 100}%`, backgroundColor: BAR_COLOR[entry.status] }}
            />
          ))}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2">
        {entries.map((entry) => (
          <div key={entry.status} className="flex items-center justify-between gap-3 text-[13px]">
            <dt className="flex items-center gap-2 whitespace-nowrap text-ash">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: BAR_COLOR[entry.status] }} aria-hidden="true" />
              {ORDER_STATUS_LABEL[entry.status]}
            </dt>
            <dd className="font-semibold tabular-nums">{formatCount(entry.count)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
