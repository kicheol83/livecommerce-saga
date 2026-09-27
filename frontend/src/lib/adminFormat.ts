import type { OrderStatus } from "./types";

export type Tone = "done" | "progress" | "danger" | "neutral";

export const ORDER_STATUS_ORDER: OrderStatus[] = [
  "AWAITING_STOCK",
  "AWAITING_PAYMENT",
  "PAYMENT_CONFIRMING",
  "CONFIRMING_STOCK",
  "COMPENSATING",
  "COMPLETED",
  "CANCELLED"
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  AWAITING_STOCK: "재고 확보 중",
  AWAITING_PAYMENT: "결제 대기",
  PAYMENT_CONFIRMING: "결제 승인 중",
  CONFIRMING_STOCK: "재고 확정 중",
  COMPENSATING: "환불 중",
  COMPLETED: "완료",
  CANCELLED: "취소"
};

export const ORDER_STATUS_TONE: Record<OrderStatus, Tone> = {
  AWAITING_STOCK: "progress",
  AWAITING_PAYMENT: "neutral",
  PAYMENT_CONFIRMING: "progress",
  CONFIRMING_STOCK: "progress",
  COMPENSATING: "danger",
  COMPLETED: "done",
  CANCELLED: "danger"
};

export const RETRYABLE_STATUSES: OrderStatus[] = ["AWAITING_STOCK", "PAYMENT_CONFIRMING", "CONFIRMING_STOCK", "COMPENSATING"];
export const CANCELLABLE_STATUSES: OrderStatus[] = ["AWAITING_STOCK", "AWAITING_PAYMENT"];

const REASON_LABEL: Record<string, string> = {
  "insufficient stock": "재고 부족",
  "inventory step timed out": "재고 응답 지연",
  "payment window expired": "결제 시간 만료",
  "cancelled by buyer": "구매자 취소",
  "cancelled by admin": "관리자 취소",
  "payment declined": "결제 거절",
  "stock hold expired": "재고 확보 만료, 환불",
  "stock hold not found": "재고 확정 실패, 환불"
};

export function reasonLabel(reason: string | null): string {
  if (reason === null) {
    return "";
  }
  return REASON_LABEL[reason] ?? reason;
}

export const EVENT_LABEL: Record<string, string> = {
  InventoryReserved: "재고 확보",
  InventoryFailed: "재고 부족",
  InventoryConfirmed: "재고 확정",
  InventoryConfirmFailed: "재고 확정 실패",
  PaymentConfirmed: "결제 승인",
  PaymentFailed: "결제 거절",
  PaymentCancelled: "결제 취소"
};

export const TONE_CLASS: Record<Tone, string> = {
  done: "bg-[#DCEEE4] text-[#1D5A43]",
  progress: "bg-mustard/20 text-[#7A5510]",
  danger: "bg-cranberry/10 text-cranberry",
  neutral: "bg-ash/15 text-pine"
};

export function shortId(id: string): string {
  return id.slice(0, 8);
}
