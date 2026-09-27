import type { OrderStatus } from "./types";

export type AdminOrder = {
  orderId: string;
  memberId: string;
  productId: string;
  quantity: number;
  amount: number | null;
  status: OrderStatus;
  failureReason: string | null;
  retryCount: number;
  paymentDeadline: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminPage<T> = {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type MinuteBucket = {
  minute: string;
  created: number;
  completed: number;
};

export type OrderSummary = {
  countsByStatus: Partial<Record<OrderStatus, number>>;
  completedRevenue: number;
  ordersLast24h: number;
  completedLast24h: number;
  stalledOrders: number;
  averageCompletionSeconds: number | null;
  ordersPerMinute: MinuteBucket[];
};

export type PaymentSummary = {
  countsByStatus: Record<string, number>;
  confirmedAmount: number;
  refundedAmount: number;
};

export type AdminPayment = {
  paymentId: string;
  orderId: string;
  amount: number;
  status: "CONFIRMED" | "FAILED" | "CANCELLED";
  method: string | null;
  paymentKeyPreview: string | null;
  approvedAt: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  cancelledAt: string | null;
  createdAt: string;
};

export type AdminReservation = {
  reservationId: string;
  orderId: string;
  productId: string;
  quantity: number;
  status: "HELD" | "CONFIRMED" | "RELEASED" | "EXPIRED";
  expiresAt: string | null;
  createdAt: string;
};

export type OutboxEvent = {
  id: string;
  aggregateId: string;
  eventType: string;
  topic: string;
  status: "PENDING" | "PUBLISHED" | "FAILED";
  attempts: number;
  lastError: string | null;
  traceParent: string | null;
  createdAt: string;
};

export type OutboxHealth = {
  pending: number;
  oldestPendingAgeSeconds: number | null;
  pendingWithErrors: number;
  publishedLastHour: number;
  recentErrors: OutboxEvent[];
};

export type AdminProduct = {
  productId: string;
  quantityAvailable: number;
  unitPrice: number;
  heldQuantity: number;
  heldOrders: number;
  soldQuantity: number;
};

export type OutboxService = "payments" | "inventory";

export type AdminActionResult<T> = { ok: true; value: T } | { ok: false; code: string };
