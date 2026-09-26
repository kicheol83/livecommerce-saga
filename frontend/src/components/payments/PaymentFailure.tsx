"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";
import { cancelOrder } from "@/lib/api";
import { tossFailureMessage } from "@/lib/paymentMessages";

type CancelState = "idle" | "cancelling" | "cancelled" | "failed";

export function PaymentFailure() {
  const params = useSearchParams();
  const orderId = params.getAll("orderId")[0] ?? null;
  const reason = tossFailureMessage(params.get("code"), params.get("message"));
  const auth = useAuth();
  const [cancelState, setCancelState] = useState<CancelState>("idle");

  const handleCancel = async () => {
    if (orderId === null || cancelState === "cancelling") {
      return;
    }
    setCancelState("cancelling");
    const result = await cancelOrder(orderId);
    setCancelState(result.ok ? "cancelled" : "failed");
  };

  if (cancelState === "cancelled") {
    return (
      <AuthShell title="주문을 취소했어요" description="확보했던 재고는 바로 반환됐어요. 결제는 진행되지 않았어요.">
        <Link
          href="/"
          className="flex h-[52px] items-center justify-center rounded-[14px] bg-pine text-[16px] font-semibold text-frost"
        >
          라이브로 돌아가기
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="결제가 완료되지 않았어요"
      description={`${reason} 주문은 결제 시간이 끝날 때까지 유지돼요.`}
    >
      <div className="flex flex-col gap-3">
        {orderId !== null && (
          <Link
            href={`/?order=${encodeURIComponent(orderId)}`}
            className="flex h-[52px] items-center justify-center rounded-[14px] bg-cranberry text-[16px] font-bold text-white hover:bg-cranberry-700"
          >
            다시 결제하기
          </Link>
        )}
        {orderId !== null && auth.status === "authenticated" && (
          <button
            type="button"
            onClick={() => {
              void handleCancel();
            }}
            disabled={cancelState === "cancelling"}
            className="h-12 rounded-[14px] border border-frost-300 bg-white text-[15px] font-semibold text-pine disabled:opacity-50"
          >
            {cancelState === "cancelling" ? "취소하는 중" : "주문 취소하기"}
          </button>
        )}
        {cancelState === "failed" && (
          <p role="alert" className="rounded-[12px] bg-cranberry/10 px-3.5 py-2.5 text-[14px] text-cranberry">
            주문을 취소하지 못했어요. 결제 시간이 끝나면 자동으로 취소돼요.
          </p>
        )}
        <Link href="/" className="text-center text-[14px] font-medium text-ash underline underline-offset-4">
          라이브로 돌아가기
        </Link>
      </div>
    </AuthShell>
  );
}
