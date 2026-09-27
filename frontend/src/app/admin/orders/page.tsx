"use client";

import { useCallback, useState } from "react";
import { EmptyState, PageHeader, StatusBadge } from "@/components/admin/AdminParts";
import { OrderInspector } from "@/components/admin/OrderInspector";
import { usePolling } from "@/hooks/usePolling";
import { adminApi } from "@/lib/adminApi";
import { ORDER_STATUS_LABEL, ORDER_STATUS_ORDER, reasonLabel, shortId } from "@/lib/adminFormat";
import { formatCount, formatRelative, formatWon } from "@/lib/format";
import type { OrderStatus } from "@/lib/types";

const PAGE_SIZE = 20;
const REFRESH_MS = 5000;

export default function AdminOrdersPage() {
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
    { value: null, label: "전체" },
    ...ORDER_STATUS_ORDER.map((value) => ({ value, label: ORDER_STATUS_LABEL[value] }))
  ];
  const from = data === null || data.totalElements === 0 ? 0 : data.page * data.size + 1;
  const to = data === null ? 0 : Math.min(data.totalElements, (data.page + 1) * data.size);

  return (
    <div className="space-y-5">
      <PageHeader
        title="주문"
        description="주문을 선택하면 세 서비스에 걸친 Saga 진행 상황을 한 화면에서 볼 수 있어요."
        updatedAt={updatedAt}
        failed={failed}
        onRefresh={refresh}
      />

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="주문 상태 필터">
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
                <th scope="col" className="px-5 py-3">주문번호</th>
                <th scope="col" className="px-3 py-3">상태</th>
                <th scope="col" className="px-3 py-3 text-right">수량</th>
                <th scope="col" className="px-3 py-3 text-right">금액</th>
                <th scope="col" className="px-3 py-3">사유</th>
                <th scope="col" className="px-3 py-3 text-right">재시도</th>
                <th scope="col" className="px-5 py-3 text-right">최근 변경</th>
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
            <EmptyState>조건에 맞는 주문이 없어요.</EmptyState>
          </div>
        )}
        {data === null && !failed && <div className="m-5 h-48 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />}
        <footer className="flex items-center justify-between border-t border-frost-300 px-5 py-3 text-[13px] text-ash">
          <span className="tabular-nums">
            {data === null ? "" : `${formatCount(data.totalElements)}건 중 ${from}–${to}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="h-9 rounded-full border border-frost-300 px-4 font-semibold text-pine disabled:opacity-40"
            >
              이전
            </button>
            <button
              type="button"
              disabled={data === null || page + 1 >= data.totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="h-9 rounded-full border border-frost-300 px-4 font-semibold text-pine disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </footer>
      </section>

      {selected !== null && <OrderInspector orderId={selected} onClose={() => setSelected(null)} onChanged={refresh} />}
    </div>
  );
}
