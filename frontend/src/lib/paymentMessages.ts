const SUBMIT_ERRORS: Record<string, string> = {
  AMOUNT_MISMATCH: "결제 금액이 주문 금액과 달라 결제를 진행하지 않았어요.",
  PAYMENT_WINDOW_EXPIRED: "결제 시간이 지나 주문이 취소됐어요. 결제는 승인되지 않았어요.",
  ORDER_NOT_PAYABLE: "이미 처리됐거나 결제할 수 없는 주문이에요.",
  NOT_FOUND: "주문을 찾을 수 없어요.",
  UNAUTHORIZED: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  NETWORK_ERROR: "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
};

const TOSS_FAILURES: Record<string, string> = {
  PAY_PROCESS_CANCELED: "결제를 취소했어요.",
  PAY_PROCESS_ABORTED: "결제가 중간에 중단됐어요.",
  REJECT_CARD_COMPANY: "카드사에서 결제를 거절했어요."
};

export function paymentSubmitError(code: string): string {
  return SUBMIT_ERRORS[code] ?? "결제를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

export function tossFailureMessage(code: string | null, message: string | null): string {
  if (code !== null && TOSS_FAILURES[code] !== undefined) {
    return TOSS_FAILURES[code];
  }
  return message ?? "결제가 완료되지 않았어요.";
}
