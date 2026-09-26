import type { OrderSnapshot, OrderStatus } from "./types";

export type StepState = "done" | "active" | "pending" | "failed";

export type ProgressStep = {
  label: string;
  state: StepState;
};

export type OrderOutcome = "processing" | "completed" | "cancelled";

const STEP_LABELS = ["재고 확보", "결제", "결제 승인", "주문 완료"];

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

const FAILURE_MESSAGES: Record<string, string> = {
  "insufficient stock": "남은 수량이 부족해 주문하지 못했어요. 결제는 진행되지 않았어요.",
  "inventory step timed out": "재고 확인이 늦어져 주문이 취소됐어요. 결제는 진행되지 않았어요.",
  "payment window expired": "결제 시간이 지나 주문이 취소됐어요. 확보했던 재고는 반환됐어요.",
  "cancelled by buyer": "주문을 취소했어요. 확보했던 재고는 바로 반환됐어요.",
  "payment declined": "카드사에서 결제를 승인하지 않았어요. 확보했던 재고는 반환됐어요.",
  "stock hold expired": "결제를 확인하는 동안 재고 확보 시간이 끝나 주문이 취소됐어요. 결제 금액은 자동으로 환불돼요.",
  "stock hold not found": "재고를 확정하지 못해 주문이 취소됐어요. 결제 금액은 자동으로 환불돼요."
};

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
    return "주문이 취소됐어요.";
  }
  return FAILURE_MESSAGES[reason] ?? "주문이 취소됐어요.";
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
