"use client";

import {
  loadTossPayments,
  type TossPaymentsWidgets,
  type WidgetAgreementWidget,
  type WidgetPaymentMethodWidget
} from "@tosspayments/tosspayments-sdk";
import { useEffect, useRef, useState } from "react";
import { TOSS_CLIENT_KEY } from "@/lib/config";
import { formatWon } from "@/lib/format";
import { t } from "@/i18n/core";

type PaymentPanelProps = {
  orderId: string;
  orderName: string;
  amount: number;
  customerKey: string;
  customerEmail: string;
  customerName: string;
};

let previousTeardown: Promise<unknown> = Promise.resolve();

export function PaymentPanel({ orderId, orderName, amount, customerKey, customerEmail, customerName }: PaymentPanelProps) {
  const widgetsRef = useRef<TossPaymentsWidgets | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let methods: WidgetPaymentMethodWidget | null = null;
    let agreement: WidgetAgreementWidget | null = null;
    setStatus("loading");

    const render = async () => {
      await previousTeardown;
      if (disposed) {
        return;
      }
      try {
        const toss = await loadTossPayments(TOSS_CLIENT_KEY);
        const widgets = toss.widgets({ customerKey });
        await widgets.setAmount({ currency: "KRW", value: amount });
        if (disposed) {
          return;
        }
        [methods, agreement] = await Promise.all([
          widgets.renderPaymentMethods({ selector: "#toss-payment-methods", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#toss-agreement", variantKey: "AGREEMENT" })
        ]);
        if (!disposed) {
          widgetsRef.current = widgets;
          setStatus("ready");
        }
      } catch {
        if (!disposed) {
          setStatus("error");
        }
      }
    };

    const timer = setTimeout(() => {
      void render();
    }, 0);

    return () => {
      disposed = true;
      clearTimeout(timer);
      widgetsRef.current = null;
      previousTeardown = Promise.all([methods?.destroy(), agreement?.destroy()]).catch(() => undefined);
    };
  }, [amount, customerKey, attempt]);

  const handlePay = async () => {
    const widgets = widgetsRef.current;
    if (widgets === null || requesting) {
      return;
    }
    setRequesting(true);
    setRequestError(null);
    try {
      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payments/success`,
        failUrl: `${window.location.origin}/payments/fail?orderId=${encodeURIComponent(orderId)}`,
        customerEmail,
        customerName
      });
    } catch (error) {
      setRequesting(false);
      setRequestError(error instanceof Error && error.message !== "" ? error.message : t("live.payment.startFailed"));
    }
  };

  return (
    <div className="mt-4">
      <div className="overflow-hidden rounded-[14px] bg-white">
        <div id="toss-payment-methods" />
        <div id="toss-agreement" />
        {status === "loading" && (
          <div className="space-y-2 p-4" aria-busy="true" aria-label={t("live.payment.loadingMethods")}>
            <div className="h-5 w-32 animate-pulse rounded-md bg-frost-300 motion-reduce:animate-none" />
            <div className="h-12 w-full animate-pulse rounded-[10px] bg-frost-300 motion-reduce:animate-none" />
            <div className="h-12 w-full animate-pulse rounded-[10px] bg-frost-300 motion-reduce:animate-none" />
          </div>
        )}
        {status === "error" && (
          <div className="p-4 text-[14px] leading-relaxed text-pine">
            <p className="font-semibold">{t("live.payment.loadFailed")}</p>
            <p className="mt-1 text-ash">{t("live.payment.checkNetwork")}</p>
            <button
              type="button"
              onClick={() => setAttempt((current) => current + 1)}
              className="mt-3 h-10 rounded-full bg-pine px-4 text-[14px] font-semibold text-frost"
            >
              {t("live.payment.reload")}
            </button>
          </div>
        )}
      </div>
      {requestError !== null && (
        <p role="alert" className="mt-3 rounded-[12px] bg-cranberry/10 px-3.5 py-2.5 text-[14px] text-cranberry">
          {requestError}
        </p>
      )}
      <button
        type="button"
        onClick={() => {
          void handlePay();
        }}
        disabled={status !== "ready" || requesting}
        className="mt-4 h-[52px] w-full rounded-[14px] bg-cranberry text-[16px] font-bold text-white transition-colors hover:bg-cranberry-700 disabled:bg-ash/50"
      >
        {requesting ? t("live.payment.opening") : t("live.payment.pay", { amount: formatWon(amount) })}
      </button>
    </div>
  );
}
