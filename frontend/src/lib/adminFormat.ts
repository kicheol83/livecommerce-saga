import type { OrderStatus } from "./types";
import { translatedRecord } from "@/i18n/core";

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

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = translatedRecord({
  AWAITING_STOCK: "admin.status.AWAITING_STOCK",
  AWAITING_PAYMENT: "admin.status.AWAITING_PAYMENT",
  PAYMENT_CONFIRMING: "admin.status.PAYMENT_CONFIRMING",
  CONFIRMING_STOCK: "admin.status.CONFIRMING_STOCK",
  COMPENSATING: "admin.status.COMPENSATING",
  COMPLETED: "admin.status.COMPLETED",
  CANCELLED: "admin.status.CANCELLED"
});

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

const REASON_LABEL: Record<string, string> = translatedRecord({
  "insufficient stock": "admin.reason.insufficient stock",
  "inventory step timed out": "admin.reason.inventory step timed out",
  "payment window expired": "admin.reason.payment window expired",
  "cancelled by buyer": "admin.reason.cancelled by buyer",
  "cancelled by admin": "admin.reason.cancelled by admin",
  "payment declined": "admin.reason.payment declined",
  "stock hold expired": "admin.reason.stock hold expired",
  "stock hold not found": "admin.reason.stock hold not found"
});

export function reasonLabel(reason: string | null): string {
  if (reason === null) {
    return "";
  }
  return REASON_LABEL[reason] ?? reason;
}

export const EVENT_LABEL: Record<string, string> = translatedRecord({
  InventoryReserved: "admin.event.InventoryReserved",
  InventoryFailed: "admin.event.InventoryFailed",
  InventoryConfirmed: "admin.event.InventoryConfirmed",
  InventoryConfirmFailed: "admin.event.InventoryConfirmFailed",
  PaymentConfirmed: "admin.event.PaymentConfirmed",
  PaymentFailed: "admin.event.PaymentFailed",
  PaymentCancelled: "admin.event.PaymentCancelled"
});

export const TONE_CLASS: Record<Tone, string> = {
  done: "bg-[#DCEEE4] text-[#1D5A43]",
  progress: "bg-mustard/20 text-[#7A5510]",
  danger: "bg-cranberry/10 text-cranberry",
  neutral: "bg-ash/15 text-pine"
};

export function shortId(id: string): string {
  return id.slice(0, 8);
}
