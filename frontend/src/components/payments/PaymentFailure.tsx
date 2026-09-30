"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { useAuth } from "@/hooks/useAuth";
import { cancelOrder } from "@/lib/api";
import { tossFailureMessage } from "@/lib/paymentMessages";
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";

type CancelState = "idle" | "cancelling" | "cancelled" | "failed";

export function PaymentFailure() {
  useI18n();
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
      <AuthShell title={t("paymentPage.cancelledTitle")} description={t("paymentPage.cancelledBody")}>
        <Link
          href="/"
          className="flex h-[52px] items-center justify-center rounded-[14px] bg-pine text-[16px] font-semibold text-frost"
        >
          {t("common.backToLive")}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("paymentPage.failedTitle")}
      description={t("paymentPage.failedBody", { reason })}
    >
      <div className="flex flex-col gap-3">
        {orderId !== null && (
          <Link
            href={`/?order=${encodeURIComponent(orderId)}`}
            className="flex h-[52px] items-center justify-center rounded-[14px] bg-cranberry text-[16px] font-bold text-white hover:bg-cranberry-700"
          >
            {t("paymentPage.retry")}
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
            {cancelState === "cancelling" ? t("paymentPage.cancelling") : t("paymentPage.cancel")}
          </button>
        )}
        {cancelState === "failed" && (
          <p role="alert" className="rounded-[12px] bg-cranberry/10 px-3.5 py-2.5 text-[14px] text-cranberry">
            {t("paymentPage.cancelFailed")}
          </p>
        )}
        <Link href="/" className="text-center text-[14px] font-medium text-ash underline underline-offset-4">
          {t("common.backToLive")}
        </Link>
      </div>
    </AuthShell>
  );
}
