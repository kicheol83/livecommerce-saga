import type { OrderSnapshot, OrderStatus } from "./types";
import { t, translatedList, translatedRecord } from "@/i18n/core";

export type StepState = "done" | "active" | "pending" | "failed";

export type ProgressStep = {
  label: string;
  state: StepState;
};

export type OrderOutcome = "processing" | "completed" | "cancelled";

const STEP_LABELS = translatedList(["order.step.stock", "order.step.payment", "order.step.approval", "order.step.completed"]);

const STATUS_RANK: Record<OrderStatus, number> = {
  AWAITING_STOCK: 0,
  AWAITING_PAYMENT: 1,
  PAYMENT_CONFIRMING: 2,
  CONFIRMING_STOCK: 3,
  COMPENSATING: 4,
  COMPLETED: 5,
  CANCELLED: 5
};

const ACTIVE_STEP: Partial<Record<OrderStatus, number>> = {
  AWAITING_STOCK: 0,
  AWAITING_PAYMENT: 1,
  PAYMENT_CONFIRMING: 2,
  CONFIRMING_STOCK: 3
};

const FAILED_STEP: Record<string, number> = {
  "insufficient stock": 0,
  "inventory step timed out": 0,
  "payment window expired": 1,
  "cancelled by buyer": 1,
  "payment declined": 2,
  "stock hold expired": 3,
  "stock hold not found": 3
};

const FAILURE_MESSAGES: Record<string, string> = translatedRecord({
  "insufficient stock": "order.failure.insufficient stock",
  "inventory step timed out": "order.failure.inventory step timed out",
  "payment window expired": "order.failure.payment window expired",
  "cancelled by buyer": "order.failure.cancelled by buyer",
  "payment declined": "order.failure.payment declined",
  "stock hold expired": "order.failure.stock hold expired",
  "stock hold not found": "order.failure.stock hold not found"
});

export function isNewer(next: OrderSnapshot, current: OrderSnapshot | null): boolean {
  if (current === null || current.orderId !== next.orderId) {
    return true;
  }
  return STATUS_RANK[next.status] >= STATUS_RANK[current.status];
}

export function isTerminal(status: OrderStatus): boolean {
  return status === "COMPLETED" || status === "CANCELLED";
}

export function outcomeOf(snapshot: OrderSnapshot | null): OrderOutcome {
  if (snapshot?.status === "COMPLETED") {
    return "completed";
  }
  if (snapshot?.status === "CANCELLED") {
    return "cancelled";
  }
  return "processing";
}

export function failureMessage(reason: string | null): string {
  if (reason === null) {
    return t("order.failure.default");
  }
  return FAILURE_MESSAGES[reason] ?? t("order.failure.default");
}

function markUpTo(index: number, state: StepState): StepState[] {
  return STEP_LABELS.map((_, position) => (position < index ? "done" : position === index ? state : "pending"));
}

function stepStates(snapshot: OrderSnapshot | null): StepState[] {
  if (snapshot === null) {
    return markUpTo(0, "active");
  }
  switch (snapshot.status) {
    case "COMPLETED":
      return STEP_LABELS.map(() => "done");
    case "COMPENSATING":
      return markUpTo(3, "failed");
    case "CANCELLED": {
      const failedAt = FAILED_STEP[snapshot.failureReason ?? ""];
      return failedAt === undefined ? STEP_LABELS.map(() => "pending") : markUpTo(failedAt, "failed");
    }
    default:
      return markUpTo(ACTIVE_STEP[snapshot.status] ?? 0, "active");
  }
}

export function progressSteps(snapshot: OrderSnapshot | null): ProgressStep[] {
  const states = stepStates(snapshot);
  return STEP_LABELS.map((label, index) => ({ label, state: states[index] }));
}
