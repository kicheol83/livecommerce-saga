"use client";

import { useEffect, useRef } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import type { AuthUser } from "@/lib/authStore";
import { formatRemaining } from "@/lib/format";
import { failureMessage, outcomeOf, progressSteps } from "@/lib/orderProgress";
import { addressLine } from "@/lib/shipping";
import type { OrderSnapshot } from "@/lib/types";
import { PaymentPanel } from "./PaymentPanel";
import { SagaStepper } from "./SagaStepper";
import { t } from "@/i18n/core";

type OrderSheetProps = {
  snapshot: OrderSnapshot | null;
  productName: string;
  quantity: number;
  user: AuthUser | null;
  cancelling: boolean;
  onCancelOrder: () => void;
  onClose: () => void;
};

const NO_OP = () => undefined;

function describe(snapshot: OrderSnapshot | null, productName: string, quantity: number, remaining: number | null) {
  const outcome = outcomeOf(snapshot);
  if (outcome === "completed") {
    return { title: t("sheet.completedTitle"), description: t("sheet.completedBody", { product: productName, quantity }) };
  }
  if (outcome === "cancelled") {
    return { title: t("sheet.cancelledTitle"), description: failureMessage(snapshot?.failureReason ?? null) };
  }
  switch (snapshot?.status) {
    case "AWAITING_PAYMENT":
      return {
        title: t("sheet.payTitle"),
        description:
          remaining === null
            ? t("sheet.payBody")
            : t("sheet.payBodyTimed", { time: formatRemaining(remaining) })
      };
    case "PAYMENT_CONFIRMING":
    case "CONFIRMING_STOCK":
      return { title: t("sheet.verifyingTitle"), description: t("sheet.verifyingBody") };
    case "COMPENSATING":
      return { title: t("sheet.compensatingTitle"), description: t("sheet.compensatingBody") };
    default:
      return { title: t("sheet.reservingTitle"), description: t("sheet.reservingBody") };
  }
}

export function OrderSheet({ snapshot, productName, quantity, user, cancelling, onCancelOrder, onClose }: OrderSheetProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const outcome = outcomeOf(snapshot);
  const awaitingPayment = snapshot?.status === "AWAITING_PAYMENT";
  const remaining = useCountdown(awaitingPayment ? snapshot?.paymentDeadline ?? null : null, NO_OP);
  const { title, description } = describe(snapshot, productName, quantity, remaining);
  const dismissible = !awaitingPayment;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!dismissible) {
      return;
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [dismissible, onClose]);

  const showPayment = awaitingPayment && snapshot !== null && snapshot.amount !== null && user !== null;

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div
        className="absolute inset-0 animate-fade_in bg-black/50"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-sheet-title"
        className="relative max-h-[92%] animate-sheet_in overflow-y-auto rounded-t-[22px] bg-frost px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 text-pine motion-reduce:animate-none"
      >
        <h2 id="order-sheet-title" ref={headingRef} tabIndex={-1} className="text-[19px] font-bold outline-none">
          {title}
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ash tabular-nums" aria-live="polite">
          {description}
        </p>
        {awaitingPayment && user?.shippingAddress != null && (
          <p className="mt-3 rounded-[12px] bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-ash">
            <span className="font-semibold text-pine">{t("sheet.shippingTo")}</span> {user.shippingAddress.recipientName},{" "}
            {addressLine(user.shippingAddress)}
          </p>
        )}
        <SagaStepper steps={progressSteps(snapshot)} />
        {showPayment && snapshot !== null && snapshot.amount !== null && user !== null && (
          <PaymentPanel
            orderId={snapshot.orderId}
            orderName={t("sheet.orderName", { product: productName, quantity })}
            amount={snapshot.amount}
            customerKey={user.userId}
            customerEmail={user.email}
            customerName={user.nickname}
          />
        )}
        {snapshot !== null && (
          <p className="mt-5 text-[12px] text-ash tabular-nums">{t("sheet.orderNumber", { id: snapshot.orderId.slice(0, 8) })}</p>
        )}
        {awaitingPayment ? (
          <button
            type="button"
            onClick={onCancelOrder}
            disabled={cancelling}
            className="mt-3 h-12 w-full rounded-[14px] border border-frost-300 bg-white text-[15px] font-semibold text-pine disabled:opacity-50"
          >
            {cancelling ? t("sheet.cancelling") : t("sheet.cancel")}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 h-12 w-full rounded-[14px] bg-pine text-[15px] font-semibold text-frost"
          >
            {outcome === "processing" ? t("common.close") : t("common.confirm")}
          </button>
        )}
      </section>
    </div>
  );
}
