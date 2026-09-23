"use client";

import { useEffect, useRef } from "react";
import { failureMessage, outcomeOf, progressSteps } from "@/lib/orderProgress";
import type { OrderSnapshot } from "@/lib/types";
import { SagaStepper } from "./SagaStepper";

type OrderSheetProps = {
  snapshot: OrderSnapshot | null;
  productName: string;
  quantity: number;
  onClose: () => void;
};

function describe(snapshot: OrderSnapshot | null, productName: string, quantity: number) {
  const outcome = outcomeOf(snapshot);
  if (outcome === "completed") {
    return { title: "주문이 완료됐어요", description: `${productName} ${quantity}개를 주문했어요.` };
  }
  if (outcome === "cancelled") {
    return { title: "주문이 취소됐어요", description: failureMessage(snapshot?.failureReason ?? null) };
  }
  if (snapshot?.status === "COMPENSATING") {
    return { title: "주문을 처리하고 있어요", description: "재고를 확보하지 못해 결제를 취소하고 있어요." };
  }
  return { title: "주문을 처리하고 있어요", description: "결제와 재고 확인이 끝나면 바로 알려 드릴게요." };
}

export function OrderSheet({ snapshot, productName, quantity, onClose }: OrderSheetProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const outcome = outcomeOf(snapshot);
  const { title, description } = describe(snapshot, productName, quantity);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 animate-fade_in bg-black/50" onClick={onClose} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-sheet-title"
        className="relative animate-sheet_in rounded-t-[22px] bg-frost px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 text-pine motion-reduce:animate-none"
      >
        <h2 id="order-sheet-title" ref={headingRef} tabIndex={-1} className="text-[19px] font-bold outline-none">
          {title}
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ash" aria-live="polite">
          {description}
        </p>
        <SagaStepper steps={progressSteps(snapshot)} />
        {snapshot !== null && (
          <p className="mt-5 text-[12px] text-ash tabular-nums">주문번호 {snapshot.orderId.slice(0, 8)}</p>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-4 h-12 w-full rounded-[14px] bg-pine text-[15px] font-semibold text-frost"
        >
          {outcome === "processing" ? "닫기" : "확인"}
        </button>
      </section>
    </div>
  );
}
