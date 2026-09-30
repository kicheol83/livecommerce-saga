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
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";

export function PaymentSuccess() {
  useI18n();
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
      setError(t("paymentPage.invalid"));
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
      ? t("paymentPage.verifyFailed")
      : outcome === "completed"
        ? t("paymentPage.completed")
        : outcome === "cancelled"
          ? t("paymentPage.cancelled")
          : t("paymentPage.verifying");
  const description =
    error ??
    (outcome === "completed"
      ? t("paymentPage.completedBody")
      : outcome === "cancelled"
        ? failureMessage(tracked?.failureReason ?? null)
        : t("paymentPage.verifyingBody"));

  return (
    <AuthShell title={title} description={description}>
      <div aria-live="polite">
        {tracked !== null && <SagaStepper steps={progressSteps(tracked)} />}
        {Number.isFinite(amount) && amount > 0 && (
          <p className="mt-5 flex justify-between text-[15px]">
            <span className="text-ash">{t("paymentPage.amount")}</span>
            <span className="font-bold tabular-nums">{formatWon(amount)}</span>
          </p>
        )}
      </div>
      <Link
        href="/me"
        className="mt-6 flex h-[52px] items-center justify-center rounded-[14px] bg-pine text-[16px] font-semibold text-frost"
      >
        {t("paymentPage.viewOrders")}
      </Link>
      <Link href="/" className="mt-3 block text-center text-[14px] font-medium text-ash underline underline-offset-4">
        {t("common.backToLive")}
      </Link>
    </AuthShell>
  );
}
