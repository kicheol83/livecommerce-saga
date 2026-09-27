import { ApiError } from "./api";
import { authFetch } from "./authStore";
import type {
  AdminActionResult,
  AdminOrder,
  AdminPage,
  AdminPayment,
  AdminProduct,
  AdminReservation,
  OrderSummary,
  OutboxEvent,
  OutboxHealth,
  OutboxService,
  PaymentSummary
} from "./adminTypes";
import type { OrderStatus } from "./types";

async function getJson<T>(path: string): Promise<T> {
  const response = await authFetch(path);
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return (await response.json()) as T;
}

async function getOptional<T>(path: string): Promise<T | null> {
  const response = await authFetch(path);
  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return (await response.json()) as T;
}

async function send<T>(path: string, method: string, body?: unknown): Promise<AdminActionResult<T>> {
  try {
    const response = await authFetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    if (response.ok) {
      return { ok: true, value: (await response.json()) as T };
    }
    const payload = (await response.json().catch(() => ({}))) as { code?: string };
    return { ok: false, code: payload.code ?? `HTTP_${response.status}` };
  } catch {
    return { ok: false, code: "NETWORK_ERROR" };
  }
}

export const adminApi = {
  orderSummary: () => getJson<OrderSummary>("/api/admin/orders/summary"),
  paymentSummary: () => getJson<PaymentSummary>("/api/admin/payments/summary"),
  orders: (status: OrderStatus | null, page: number, size: number) => {
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status !== null) {
      params.set("status", status);
    }
    return getJson<AdminPage<AdminOrder>>(`/api/admin/orders?${params.toString()}`);
  },
  order: (orderId: string) => getJson<AdminOrder>(`/api/admin/orders/${encodeURIComponent(orderId)}`),
  payment: (orderId: string) => getOptional<AdminPayment>(`/api/admin/payments/orders/${encodeURIComponent(orderId)}`),
  reservation: (orderId: string) =>
    getOptional<AdminReservation>(`/api/admin/inventory/reservations/${encodeURIComponent(orderId)}`),
  outbox: (service: OutboxService, aggregateId: string) =>
    getJson<OutboxEvent[]>(`/api/admin/${service}/outbox?aggregateId=${encodeURIComponent(aggregateId)}`),
  outboxHealth: (service: OutboxService) => getJson<OutboxHealth>(`/api/admin/${service}/outbox/health`),
  products: () => getJson<AdminProduct[]>("/api/admin/inventory/products"),
  updateProduct: (productId: string, quantityAvailable: number, unitPrice: number) =>
    send<AdminProduct>(`/api/admin/inventory/products/${encodeURIComponent(productId)}`, "PUT", {
      quantityAvailable,
      unitPrice
    }),
  retryOrder: (orderId: string) => send<AdminOrder>(`/api/admin/orders/${encodeURIComponent(orderId)}/retry`, "POST"),
  cancelOrder: (orderId: string) => send<AdminOrder>(`/api/admin/orders/${encodeURIComponent(orderId)}/cancel`, "POST")
};
