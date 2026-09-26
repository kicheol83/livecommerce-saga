"use client";

import { useEffect, useRef } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import type { AuthUser } from "@/lib/authStore";
import { formatRemaining } from "@/lib/format";
import { failureMessage, outcomeOf, progressSteps } from "@/lib/orderProgress";
import type { OrderSnapshot } from "@/lib/types";
import { PaymentPanel } from "./PaymentPanel";
import { SagaStepper } from "./SagaStepper";

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
    return { title: "주문이 완료됐어요", description: `${productName} ${quantity}개를 주문했어요.` };
  }
  if (outcome === "cancelled") {
    return { title: "주문이 취소됐어요", description: failureMessage(snapshot?.failureReason ?? null) };
  }
  switch (snapshot?.status) {
    case "AWAITING_PAYMENT":
      return {
        title: "결제를 진행해 주세요",
        description:
          remaining === null
            ? "재고를 확보했어요. 시간 안에 결제하지 않으면 주문이 자동으로 취소돼요."
            : `재고를 확보했어요. ${formatRemaining(remaining)} 안에 결제하지 않으면 주문이 자동으로 취소돼요.`
      };
    case "PAYMENT_CONFIRMING":
    case "CONFIRMING_STOCK":
      return { title: "결제를 확인하고 있어요", description: "결제 승인과 재고 확정이 끝나면 바로 알려 드릴게요." };
    case "COMPENSATING":
      return { title: "주문을 처리하고 있어요", description: "재고를 확정하지 못해 결제를 환불하고 있어요." };
    default:
      return { title: "재고를 확보하고 있어요", description: "잠시만 기다려 주세요. 재고를 확보하면 바로 결제할 수 있어요." };
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
        <SagaStepper steps={progressSteps(snapshot)} />
        {showPayment && snapshot !== null && snapshot.amount !== null && user !== null && (
          <PaymentPanel
            orderId={snapshot.orderId}
            orderName={`${productName} ${quantity}개`}
            amount={snapshot.amount}
            customerKey={user.userId}
            customerEmail={user.email}
            customerName={user.nickname}
          />
        )}
        {snapshot !== null && (
          <p className="mt-5 text-[12px] text-ash tabular-nums">주문번호 {snapshot.orderId.slice(0, 8)}</p>
        )}
        {awaitingPayment ? (
          <button
            type="button"
            onClick={onCancelOrder}
            disabled={cancelling}
            className="mt-3 h-12 w-full rounded-[14px] border border-frost-300 bg-white text-[15px] font-semibold text-pine disabled:opacity-50"
          >
            {cancelling ? "취소하는 중" : "주문 취소"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onClose}
            className="mt-4 h-12 w-full rounded-[14px] bg-pine text-[15px] font-semibold text-frost"
          >
            {outcome === "processing" ? "닫기" : "확인"}
          </button>
        )}
      </section>
    </div>
  );
}
