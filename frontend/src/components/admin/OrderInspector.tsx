"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePolling } from "@/hooks/usePolling";
import { adminApi } from "@/lib/adminApi";
import { CANCELLABLE_STATUSES, RETRYABLE_STATUSES, reasonLabel } from "@/lib/adminFormat";
import { formatDateTime, formatWon } from "@/lib/format";
import { EmptyState, Pill, StatusBadge } from "./AdminParts";
import { SagaTimeline } from "./SagaTimeline";
import { t, translatedRecord } from "@/i18n/core";

const REFRESH_MS = 3000;

const PAYMENT_STATUS_LABEL = translatedRecord({
  CONFIRMED: "admin.inspector.paymentStatus.CONFIRMED",
  FAILED: "admin.inspector.paymentStatus.FAILED",
  CANCELLED: "admin.inspector.paymentStatus.CANCELLED"
});
const PAYMENT_STATUS_TONE = { CONFIRMED: "done", FAILED: "danger", CANCELLED: "neutral" } as const;
const HOLD_STATUS_LABEL = translatedRecord({
  HELD: "admin.inspector.holdStatus.HELD",
  CONFIRMED: "admin.inspector.holdStatus.CONFIRMED",
  RELEASED: "admin.inspector.holdStatus.RELEASED",
  EXPIRED: "admin.inspector.holdStatus.EXPIRED"
});
const HOLD_STATUS_TONE = { HELD: "progress", CONFIRMED: "done", RELEASED: "neutral", EXPIRED: "danger" } as const;

const ACTION_ERRORS: Record<string, string> = translatedRecord({
  NOT_RETRYABLE: "admin.inspector.error.NOT_RETRYABLE",
  NOT_CANCELLABLE: "admin.inspector.error.NOT_CANCELLABLE",
  NETWORK_ERROR: "admin.inspector.error.NETWORK_ERROR"
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-ash">{label}</dt>
      <dd className="mt-0.5 break-all text-[14px] font-medium tabular-nums">{children}</dd>
    </div>
  );
}

export function OrderInspector({ orderId, onClose, onChanged }: { orderId: string; onClose: () => void; onChanged: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [order, payment, reservation, paymentEvents, inventoryEvents] = await Promise.all([
      adminApi.order(orderId),
      adminApi.payment(orderId),
      adminApi.reservation(orderId),
      adminApi.outbox("payments", orderId),
      adminApi.outbox("inventory", orderId)
    ]);
    return { order, payment, reservation, paymentEvents, inventoryEvents };
  }, [orderId]);

  const { data, failed, refresh } = usePolling(load, REFRESH_MS, orderId);

  useEffect(() => {
    headingRef.current?.focus();
    setConfirmingCancel(false);
    setNotice(null);
  }, [orderId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const runAction = async (action: "retry" | "cancel") => {
    setBusy(true);
    setNotice(null);
    const result = action === "retry" ? await adminApi.retryOrder(orderId) : await adminApi.cancelOrder(orderId);
    setBusy(false);
    setConfirmingCancel(false);
    if (result.ok) {
      setNotice(action === "retry" ? t("admin.inspector.retried") : t("admin.inspector.cancelled"));
      refresh();
      onChanged();
    } else {
      setNotice(ACTION_ERRORS[result.code] ?? t("admin.inspector.error.default"));
    }
  };

  const order = data?.order ?? null;
  const canRetry = order !== null && RETRYABLE_STATUSES.includes(order.status);
  const canCancel = order !== null && CANCELLABLE_STATUSES.includes(order.status);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-pine/40 xl:bg-transparent" onClick={onClose} aria-hidden="true" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="inspector-title"
        className="relative flex h-full w-full max-w-[580px] animate-fade_in flex-col bg-white shadow-[-12px_0_40px_rgba(22,48,43,0.18)] motion-reduce:animate-none"
      >
        <header className="flex items-start justify-between gap-4 border-b border-frost-300 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-ash">{t("admin.inspector.title")}</p>
            <h2 id="inspector-title" ref={headingRef} tabIndex={-1} className="mt-0.5 break-all text-[16px] font-bold outline-none tabular-nums">
              {orderId}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 shrink-0 rounded-full border border-frost-300 px-4 text-[13px] font-semibold hover:bg-frost"
          >
            {t("common.close")}
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {failed && data === null && <EmptyState>{t("admin.inspector.loadFailed")}</EmptyState>}
          {data === null && !failed && <div className="h-64 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />}
          {data !== null && order !== null && (
            <>
              <section>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={order.status} />
                  {order.failureReason !== null && <Pill tone="danger">{reasonLabel(order.failureReason)}</Pill>}
                  {order.retryCount > 0 && <Pill tone="progress">{t("admin.inspector.retries", { count: order.retryCount })}</Pill>}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3">
                  <Field label={t("admin.inspector.quantity")}>{t("common.units", { count: order.quantity })}</Field>
                  <Field label={t("admin.inspector.amount")}>{order.amount === null ? t("admin.inspector.notFinal") : formatWon(order.amount)}</Field>
                  <Field label={t("admin.inspector.created")}>{formatDateTime(order.createdAt)}</Field>
                  <Field label={t("admin.inspector.updated")}>{formatDateTime(order.updatedAt)}</Field>
                  {order.paymentDeadline !== null && <Field label={t("admin.inspector.deadline")}>{formatDateTime(order.paymentDeadline)}</Field>}
                  <Field label={t("admin.inspector.buyer")}>{order.memberId}</Field>
                </dl>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!canRetry || busy}
                    onClick={() => {
                      void runAction("retry");
                    }}
                    className="h-10 rounded-full bg-pine px-4 text-[14px] font-semibold text-frost disabled:bg-ash/40"
                  >
                    {t("admin.inspector.retryNow")}
                  </button>
                  {confirmingCancel ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void runAction("cancel");
                        }}
                        className="h-10 rounded-full bg-cranberry px-4 text-[14px] font-semibold text-white"
                      >
                        {t("admin.inspector.confirmCancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingCancel(false)}
                        className="h-10 rounded-full border border-frost-300 px-4 text-[14px] font-semibold"
                      >
                        {t("admin.inspector.keep")}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={!canCancel || busy}
                      onClick={() => setConfirmingCancel(true)}
                      className="h-10 rounded-full border border-cranberry/40 px-4 text-[14px] font-semibold text-cranberry disabled:border-frost-300 disabled:text-ash/60"
                    >
                      {t("admin.inspector.cancelOrder")}
                    </button>
                  )}
                </div>
                {notice !== null && (
                  <p role="status" className="mt-3 text-[13px] text-ash">
                    {notice}
                  </p>
                )}
              </section>

              <section>
                <h3 className="text-[14px] font-bold">{t("admin.inspector.timeline")}</h3>
                <div className="mt-3">
                  <SagaTimeline order={order} paymentEvents={data.paymentEvents} inventoryEvents={data.inventoryEvents} />
                </div>
              </section>

              <section className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[14px] bg-frost p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold">{t("admin.inspector.payment")}</h3>
                    {data.payment !== null && (
                      <Pill tone={PAYMENT_STATUS_TONE[data.payment.status]}>{PAYMENT_STATUS_LABEL[data.payment.status]}</Pill>
                    )}
                  </div>
                  {data.payment === null ? (
                    <p className="mt-3 text-[13px] text-ash">{t("admin.inspector.noPayment")}</p>
                  ) : (
                    <dl className="mt-3 space-y-2">
                      <Field label={t("admin.inspector.amount")}>{formatWon(data.payment.amount)}</Field>
                      <Field label={t("admin.inspector.method")}>{data.payment.method ?? t("admin.inspector.unknownMethod")}</Field>
                      {data.payment.approvedAt !== null && <Field label={t("admin.inspector.approved")}>{formatDateTime(data.payment.approvedAt)}</Field>}
                      {data.payment.failureCode !== null && (
                        <Field label={t("admin.inspector.declineReason")}>
                          {data.payment.failureCode}
                          {data.payment.failureMessage !== null && ` (${data.payment.failureMessage})`}
                        </Field>
                      )}
                      {data.payment.cancelledAt !== null && <Field label={t("admin.inspector.refunded")}>{formatDateTime(data.payment.cancelledAt)}</Field>}
                      {data.payment.paymentKeyPreview !== null && <Field label="paymentKey">{data.payment.paymentKeyPreview}</Field>}
                    </dl>
                  )}
                </div>
                <div className="rounded-[14px] bg-frost p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-bold">{t("admin.inspector.reservation")}</h3>
                    {data.reservation !== null && (
                      <Pill tone={HOLD_STATUS_TONE[data.reservation.status]}>{HOLD_STATUS_LABEL[data.reservation.status]}</Pill>
                    )}
                  </div>
                  {data.reservation === null ? (
                    <p className="mt-3 text-[13px] text-ash">{t("admin.inspector.noReservation")}</p>
                  ) : (
                    <dl className="mt-3 space-y-2">
                      <Field label={t("admin.inspector.quantity")}>{t("common.units", { count: data.reservation.quantity })}</Field>
                      <Field label={t("admin.inspector.heldAt")}>{formatDateTime(data.reservation.createdAt)}</Field>
                      {data.reservation.expiresAt !== null && (
                        <Field label={t("admin.inspector.expiresAt")}>{formatDateTime(data.reservation.expiresAt)}</Field>
                      )}
                    </dl>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
