"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SagaStepper } from "@/components/live/SagaStepper";
import { useAuth } from "@/hooks/useAuth";
import { useOrderTracker } from "@/hooks/useOrderTracker";
import { fetchOrder, submitPayment } from "@/lib/api";
import { formatWon } from "@/lib/format";
import { failureMessage, outcomeOf, progressSteps } from "@/lib/orderProgress";
import { paymentSubmitError } from "@/lib/paymentMessages";
import type { OrderSnapshot } from "@/lib/types";

export function PaymentSuccess() {
  const params = useSearchParams();
  const paymentKey = params.get("paymentKey");
  const orderId = params.get("orderId");
  const amount = Number(params.get("amount"));
  const auth = useAuth();
  const submittedRef = useRef(false);
  const [initial, setInitial] = useState<OrderSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tracked = useOrderTracker(initial?.orderId ?? null, initial);

  useEffect(() => {
    if (submittedRef.current || auth.status === "loading") {
      return;
    }
    submittedRef.current = true;
    if (paymentKey === null || orderId === null || !Number.isFinite(amount) || amount <= 0) {
      setError("결제 정보가 올바르지 않아요.");
      return;
    }
    if (auth.status === "anonymous") {
      setError(paymentSubmitError("UNAUTHORIZED"));
      return;
    }
    const confirm = async () => {
      const result = await submitPayment(orderId, paymentKey, amount);
      if (result.ok) {
        setInitial(result.order);
        return;
      }
      if (result.code === "ORDER_NOT_PAYABLE") {
        const order = await fetchOrder(orderId).catch(() => null);
        if (order !== null) {
          setInitial(order);
          return;
        }
      }
      setError(paymentSubmitError(result.code));
    };
    void confirm();
  }, [amount, auth.status, orderId, paymentKey]);

  const outcome = outcomeOf(tracked);
  const title =
    error !== null
      ? "결제를 확인하지 못했어요"
      : outcome === "completed"
        ? "주문이 완료됐어요"
        : outcome === "cancelled"
          ? "주문이 취소됐어요"
          : "결제를 확인하고 있어요";
  const description =
    error ??
    (outcome === "completed"
      ? "주문이 정상적으로 접수됐어요. 라이브로 돌아가 방송을 계속 즐겨 보세요."
      : outcome === "cancelled"
        ? failureMessage(tracked?.failureReason ?? null)
        : "결제 승인과 재고 확정이 끝나면 이 화면에서 바로 알려 드릴게요.");

  return (
    <AuthShell title={title} description={description}>
      <div aria-live="polite">
        {tracked !== null && <SagaStepper steps={progressSteps(tracked)} />}
        {Number.isFinite(amount) && amount > 0 && (
          <p className="mt-5 flex justify-between text-[15px]">
            <span className="text-ash">결제 금액</span>
            <span className="font-bold tabular-nums">{formatWon(amount)}</span>
          </p>
        )}
      </div>
      <Link
        href="/me"
        className="mt-6 flex h-[52px] items-center justify-center rounded-[14px] bg-pine text-[16px] font-semibold text-frost"
      >
        주문 내역 보기
      </Link>
      <Link href="/" className="mt-3 block text-center text-[14px] font-medium text-ash underline underline-offset-4">
        라이브로 돌아가기
      </Link>
    </AuthShell>
  );
}
