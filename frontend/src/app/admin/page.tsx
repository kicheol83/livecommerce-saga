"use client";

import { useCallback } from "react";
import { Metric, PageHeader, Panel } from "@/components/admin/AdminParts";
import { OrdersChart } from "@/components/admin/OrdersChart";
import { OutboxHealthCard } from "@/components/admin/OutboxHealthCard";
import { StatusBreakdown } from "@/components/admin/StatusBreakdown";
import { usePolling } from "@/hooks/usePolling";
import { adminApi } from "@/lib/adminApi";
import { formatCount, formatDuration, formatWon } from "@/lib/format";
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";

const REFRESH_MS = 5000;

export default function AdminDashboardPage() {
  useI18n();
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
        title={t("admin.dashboard.title")}
        description={t("admin.dashboard.description")}
        updatedAt={updatedAt}
        failed={failed}
        onRefresh={refresh}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Metric
          label={t("admin.dashboard.orders24h")}
          value={orders === null ? "…" : formatCount(orders.ordersLast24h)}
          hint={orders === null ? undefined : t("admin.dashboard.completedCount", { count: formatCount(orders.completedLast24h) })}
        />
        <Metric label={t("admin.dashboard.conversion")} value={conversion === null ? t("common.none") : `${conversion}%`} hint={t("admin.dashboard.last24h")} />
        <Metric
          label={t("admin.dashboard.revenue")}
          value={orders === null ? "…" : formatWon(orders.completedRevenue)}
          hint={data === null ? undefined : t("admin.dashboard.refunded", { amount: formatWon(data.payments.refundedAmount) })}
        />
        <Metric
          label={t("admin.dashboard.avgTime")}
          value={orders?.averageCompletionSeconds == null ? t("common.none") : formatDuration(orders.averageCompletionSeconds)}
          hint={t("admin.dashboard.avgTimeHint")}
        />
        <Metric
          label={t("admin.dashboard.stuck")}
          value={orders === null ? "…" : formatCount(orders.stalledOrders)}
          hint={t("admin.dashboard.stuckHint")}
          tone={orders !== null && orders.stalledOrders > 0 ? "danger" : "neutral"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <Panel title={t("admin.dashboard.flow")}>
          {orders === null ? (
            <div className="h-44 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />
          ) : (
            <OrdersChart buckets={orders.ordersPerMinute} />
          )}
        </Panel>
        <Panel title={t("admin.dashboard.distribution")}>
          {orders === null ? (
            <div className="h-44 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />
          ) : (
            <StatusBreakdown counts={orders.countsByStatus} />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <OutboxHealthCard title={t("admin.dashboard.paymentOutbox")} health={data?.paymentOutbox ?? null} />
        <OutboxHealthCard title={t("admin.dashboard.inventoryOutbox")} health={data?.inventoryOutbox ?? null} />
        <Panel title={t("admin.dashboard.liveStock")}>
          {product === null ? (
            <div className="h-24 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />
          ) : (
            <dl className="space-y-3 text-[14px]">
              <div className="flex justify-between">
                <dt className="text-ash">{t("admin.stock.available")}</dt>
                <dd className="font-bold tabular-nums">{t("common.units", { count: formatCount(product.quantityAvailable) })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ash">{t("admin.stock.held")}</dt>
                <dd className="font-bold tabular-nums">
                  {t("common.units", { count: formatCount(product.heldQuantity) })} ({t("common.cases", { count: formatCount(product.heldOrders) })})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ash">{t("admin.stock.sold")}</dt>
                <dd className="font-bold tabular-nums">{t("common.units", { count: formatCount(product.soldQuantity) })}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ash">{t("admin.stock.price")}</dt>
                <dd className="font-bold tabular-nums">{formatWon(product.unitPrice)}</dd>
              </div>
            </dl>
          )}
        </Panel>
      </div>
    </div>
  );
}
