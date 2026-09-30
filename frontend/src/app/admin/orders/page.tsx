"use client";

import { useCallback, useState } from "react";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/AdminParts";
import { OrderInspector } from "@/components/admin/OrderInspector";
import { usePolling } from "@/hooks/usePolling";
import { adminApi } from "@/lib/adminApi";
import { ORDER_STATUS_LABEL, ORDER_STATUS_ORDER, reasonLabel, shortId } from "@/lib/adminFormat";
import { formatCount, formatRelative, formatWon } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";

const PAGE_SIZE = 20;
const REFRESH_MS = 5000;

export default function AdminOrdersPage() {
  useI18n();
  const [status, setStatus] = useState<OrderStatus | null>(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(() => adminApi.orders(status, page, PAGE_SIZE), [status, page]);
  const { data, failed, updatedAt, refresh } = usePolling(load, REFRESH_MS, `${status ?? "ALL"}-${page}`);

  const selectStatus = (next: OrderStatus | null) => {
    setStatus(next);
    setPage(0);
  };

  const filters: Array<{ value: OrderStatus | null; label: string }> = [
    { value: null, label: t("admin.orders.all") },
    ...ORDER_STATUS_ORDER.map((value) => ({ value, label: ORDER_STATUS_LABEL[value] }))
  ];
  const from = data === null || data.totalElements === 0 ? 0 : data.page * data.size + 1;
  const to = data === null ? 0 : Math.min(data.totalElements, (data.page + 1) * data.size);

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("admin.orders.title")}
        description={t("admin.orders.description")}
        updatedAt={updatedAt}
        failed={failed}
        onRefresh={refresh}
      />

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t("admin.orders.filter")}>
        {filters.map((filter) => {
          const active = filter.value === status;
          return (
            <button
              key={filter.label}
              type="button"
              aria-pressed={active}
              onClick={() => selectStatus(filter.value)}
              className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors ${
                active ? "bg-pine text-frost" : "bg-white text-pine hover:bg-frost-300/60"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-[16px] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[14px]">
            <thead className="border-b border-frost-300 text-[12px] font-semibold text-ash">
              <tr>
                <th scope="col" className="px-5 py-3">{t("admin.orders.col.id")}</th>
                <th scope="col" className="px-3 py-3">{t("admin.orders.col.status")}</th>
                <th scope="col" className="px-3 py-3 text-right">{t("admin.orders.col.quantity")}</th>
                <th scope="col" className="px-3 py-3 text-right">{t("admin.orders.col.amount")}</th>
                <th scope="col" className="px-3 py-3">{t("admin.orders.col.reason")}</th>
                <th scope="col" className="px-3 py-3 text-right">{t("admin.orders.col.retries")}</th>
                <th scope="col" className="px-5 py-3 text-right">{t("admin.orders.col.updated")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-frost-300">
              {data?.items.map((order) => (
                <tr
                  key={order.orderId}
                  onClick={() => setSelected(order.orderId)}
                  className={`cursor-pointer transition-colors hover:bg-frost ${selected === order.orderId ? "bg-frost" : ""}`}
                >
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelected(order.orderId);
                      }}
                      className="font-semibold tabular-nums underline-offset-4 hover:underline"
                    >
                      {shortId(order.orderId)}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{order.quantity}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{order.amount === null ? "–" : formatWon(order.amount)}</td>
                  <td className="px-3 py-3 text-ash">{reasonLabel(order.failureReason)}</td>
                  <td className="px-3 py-3 text-right tabular-nums">{order.retryCount > 0 ? order.retryCount : ""}</td>
                  <td className="px-5 py-3 text-right text-ash tabular-nums">{formatRelative(order.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data !== null && data.items.length === 0 && (
          <div className="p-5">
            <EmptyState>{t("admin.orders.empty")}</EmptyState>
          </div>
        )}
        {data === null && !failed && <div className="m-5 h-48 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />}
        <footer className="flex items-center justify-between border-t border-frost-300 px-5 py-3 text-[13px] text-ash">
          <span className="tabular-nums">
            {data === null ? "" : t("admin.orders.range", { total: formatCount(data.totalElements), from, to })}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="h-9 rounded-full border border-frost-300 px-4 font-semibold text-pine disabled:opacity-40"
            >
              {t("admin.orders.prev")}
            </button>
            <button
              type="button"
              disabled={data === null || page + 1 >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="h-9 rounded-full border border-frost-300 px-4 font-semibold text-pine disabled:opacity-40"
            >
              {t("admin.orders.next")}
            </button>
          </div>
        </footer>
      </section>

      {selected !== null && <OrderInspector orderId={selected} onClose={() => setSelected(null)} onChanged={refresh} />}
    </div>
  );
}
