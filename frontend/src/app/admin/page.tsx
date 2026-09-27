"use client";

import { useCallback } from "react";
import { Metric, PageHeader, Panel } from "@/components/admin/AdminParts";
import { OrdersChart } from "@/components/admin/OrdersChart";
import { OutboxHealthCard } from "@/components/admin/OutboxHealthCard";
import { StatusBreakdown } from "@/components/admin/StatusBreakdown";
import { usePolling } from "@/hooks/usePolling";
import { adminApi } from "@/lib/adminApi";
import { formatCount, formatDuration, formatWon } from "@/lib/format";

const REFRESH_MS = 5000;

export default function AdminDashboardPage() {
  const loadDashboard = useCallback(async () => {
    const [orders, payments, paymentOutbox, inventoryOutbox, products] = await Promise.all([
      adminApi.orderSummary(),
      adminApi.paymentSummary(),
      adminApi.outboxHealth("payments"),
      adminApi.outboxHealth("inventory"),
      adminApi.products()
    ]);
    return { orders, payments, paymentOutbox, inventoryOutbox, products };
  }, []);

  const { data, failed, updatedAt, refresh } = usePolling(loadDashboard, REFRESH_MS, "dashboard");
  const orders = data?.orders ?? null;
  const conversion =
    orders !== null && orders.ordersLast24h > 0 ? Math.round((orders.completedLast24h / orders.ordersLast24h) * 100) : null;
  const product = data?.products[0] ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="대시보드"
        description="주문 Saga, 결제, 이벤트 전달 상태를 5초마다 갱신해요."
        updatedAt={updatedAt}
        failed={failed}
        onRefresh={refresh}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Metric
          label="24시간 주문"
          value={orders === null ? "…" : formatCount(orders.ordersLast24h)}
          hint={orders === null ? undefined : `완료 ${formatCount(orders.completedLast24h)}건`}
        />
        <Metric label="완료율" value={conversion === null ? "없음" : `${conversion}%`} hint="24시간 기준" />
        <Metric
          label="완료 매출"
          value={orders === null ? "…" : formatWon(orders.completedRevenue)}
          hint={data === null ? undefined : `환불 ${formatWon(data.payments.refundedAmount)}`}
        />
        <Metric
          label="평균 처리 시간"
          value={orders?.averageCompletionSeconds == null ? "없음" : formatDuration(orders.averageCompletionSeconds)}
          hint="주문부터 완료까지"
        />
        <Metric
          label="정체된 주문"
          value={orders === null ? "…" : formatCount(orders.stalledOrders)}
          hint="자동 복구 대기"
          tone={orders !== null && orders.stalledOrders > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title="최근 30분 주문 흐름">
          {orders === null ? (
            <div className="h-44 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />
          ) : (
            <OrdersChart buckets={orders.ordersPerMinute} />
          )}
        </Panel>
        <Panel title="주문 상태 분포">
          {orders === null ? (
            <div className="h-44 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />
          ) : (
            <StatusBreakdown counts={orders.countsByStatus} />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <OutboxHealthCard title="결제 이벤트 전달" health={data?.paymentOutbox ?? null} />
        <OutboxHealthCard title="재고 이벤트 전달" health={data?.inventoryOutbox ?? null} />
        <Panel title="라이브 상품 재고">
          {product === null ? (
            <div className="h-24 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />
          ) : (
            <dl className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ash">판매 가능</dt>
                <dd className="font-bold tabular-nums">{formatCount(product.quantityAvailable)}개</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ash">결제 대기 중 확보</dt>
                <dd className="font-bold tabular-nums">
                  {formatCount(product.heldQuantity)}개 ({formatCount(product.heldOrders)}건)
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ash">판매 완료</dt>
                <dd className="font-bold tabular-nums">{formatCount(product.soldQuantity)}개</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ash">판매가</dt>
                <dd className="font-bold tabular-nums">{formatWon(product.unitPrice)}</dd>
              </div>
            </dl>
          )}
        </Panel>
      </div>
    </div>
  );
}
