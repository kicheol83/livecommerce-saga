import type { OrderSnapshot, OrderStatus } from "./types";

export type StepState = "done" | "active" | "pending" | "failed";

export type ProgressStep = {
  label: string;
  state: StepState;
};

export type OrderOutcome = "processing" | "completed" | "cancelled";

const STATUS_RANK: Record<OrderStatus, number> = {
  CREATED: 0,
  AWAITING_PAYMENT: 1,
  PAYMENT_CONFIRMED: 2,
  AWAITING_INVENTORY: 3,
  COMPENSATING: 4,
  COMPLETED: 5,
  CANCELLED: 5
};

const INVENTORY_FAILURES = new Set(["insufficient stock", "inventory step timed out"]);

const FAILURE_MESSAGES: Record<string, string> = {
  "insufficient stock": "남은 수량이 부족해 주문이 취소됐어요. 결제는 자동으로 취소됐어요.",
  "inventory step timed out": "재고 확인이 늦어져 주문이 취소됐어요. 결제는 자동으로 취소됐어요.",
  "payment step timed out": "결제 응답이 없어 주문이 취소됐어요.",
  "amount exceeds single payment limit": "1회 결제 한도를 넘어 주문할 수 없어요."
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

export function progressSteps(snapshot: OrderSnapshot | null): ProgressStep[] {
  const status = snapshot?.status ?? "CREATED";
  const inventoryFailed = INVENTORY_FAILURES.has(snapshot?.failureReason ?? "");
  const cancelled = status === "CANCELLED";
  const compensating = status === "COMPENSATING";
  const received: StepState = snapshot === null ? "active" : "done";

  let payment: StepState = "pending";
  if (status === "AWAITING_PAYMENT") {
    payment = "active";
  } else if (cancelled && !inventoryFailed) {
    payment = "failed";
  } else if (STATUS_RANK[status] >= STATUS_RANK.PAYMENT_CONFIRMED) {
    payment = "done";
  }

  let inventory: StepState = "pending";
  if (status === "AWAITING_INVENTORY" || status === "PAYMENT_CONFIRMED") {
    inventory = "active";
  } else if (compensating || (cancelled && inventoryFailed)) {
    inventory = "failed";
  } else if (status === "COMPLETED") {
    inventory = "done";
  }

  const completion: StepState = status === "COMPLETED" ? "done" : "pending";

  return [
    { label: "주문 접수", state: received },
    { label: "결제 승인", state: payment },
    { label: "재고 확보", state: inventory },
    { label: "주문 완료", state: completion }
  ];
}
