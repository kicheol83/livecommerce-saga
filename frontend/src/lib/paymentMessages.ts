import { t, translatedRecord } from "@/i18n/core";

const SUBMIT_ERRORS: Record<string, string> = translatedRecord({
  AMOUNT_MISMATCH: "payment.error.AMOUNT_MISMATCH",
  PAYMENT_WINDOW_EXPIRED: "payment.error.PAYMENT_WINDOW_EXPIRED",
  ORDER_NOT_PAYABLE: "payment.error.ORDER_NOT_PAYABLE",
  NOT_FOUND: "payment.error.NOT_FOUND",
  UNAUTHORIZED: "payment.error.UNAUTHORIZED",
  NETWORK_ERROR: "common.networkError"
});

const TOSS_FAILURES: Record<string, string> = translatedRecord({
  PAY_PROCESS_CANCELED: "payment.toss.PAY_PROCESS_CANCELED",
  PAY_PROCESS_ABORTED: "payment.toss.PAY_PROCESS_ABORTED",
  REJECT_CARD_COMPANY: "payment.toss.REJECT_CARD_COMPANY"
});

export function paymentSubmitError(code: string): string {
  return SUBMIT_ERRORS[code] ?? t("payment.error.default");
}

export function tossFailureMessage(code: string | null, message: string | null): string {
  if (code !== null && TOSS_FAILURES[code] !== undefined) {
    return TOSS_FAILURES[code];
  }
  return message ?? t("payment.toss.default");
}
