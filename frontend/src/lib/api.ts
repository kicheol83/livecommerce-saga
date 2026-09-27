import { authFetch, type AuthUser } from "./authStore";
import type { ChatMessage, Delivery, LiveSession, OrderPage, OrderSnapshot, OrderStatus, ShippingAddress } from "./types";

type OrderResponse = {
  orderId: string;
  status: OrderStatus;
  quantity: number;
  amount: number | null;
  paymentDeadline: string | null;
  failureReason: string | null;
};

export type OrderActionResult = { ok: true; order: OrderSnapshot } | { ok: false; status: number; code: string };

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`Request failed with status ${status}`);
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return (await response.json()) as T;
}

async function requestJson<T>(input: string): Promise<T> {
  return parse<T>(await fetch(input, { cache: "no-store" }));
}

function toSnapshot(response: OrderResponse): OrderSnapshot {
  return {
    orderId: response.orderId,
    status: response.status,
    failureReason: response.failureReason,
    amount: response.amount,
    paymentDeadline: response.paymentDeadline,
    quantity: response.quantity
  };
}

async function toActionResult(response: Response): Promise<OrderActionResult> {
  if (response.ok) {
    return { ok: true, order: toSnapshot((await response.json()) as OrderResponse) };
  }
  let code = response.status === 404 ? "NOT_FOUND" : "UNKNOWN";
  try {
    const body = (await response.json()) as { code?: string };
    code = body.code ?? code;
  } catch {
    code = response.status === 401 ? "UNAUTHORIZED" : code;
  }
  return { ok: false, status: response.status, code };
}

export function fetchSession(): Promise<LiveSession> {
  return requestJson<LiveSession>("/api/live/session");
}

export function fetchChatHistory(): Promise<ChatMessage[]> {
  return requestJson<ChatMessage[]>("/api/live/chat");
}

export async function createOrder(input: {
  productId: string;
  quantity: number;
  shippingAddress: ShippingAddress;
}): Promise<OrderSnapshot> {
  const response = await authFetch("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return toSnapshot(await parse<OrderResponse>(response));
}

export async function fetchOrder(orderId: string): Promise<OrderSnapshot> {
  const response = await authFetch(`/api/orders/${encodeURIComponent(orderId)}`);
  return toSnapshot(await parse<OrderResponse>(response));
}

export async function submitPayment(orderId: string, paymentKey: string, amount: number): Promise<OrderActionResult> {
  try {
    const response = await authFetch(`/api/orders/${encodeURIComponent(orderId)}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, amount })
    });
    return toActionResult(response);
  } catch {
    return { ok: false, status: 0, code: "NETWORK_ERROR" };
  }
}

export async function cancelOrder(orderId: string): Promise<OrderActionResult> {
  try {
    const response = await authFetch(`/api/orders/${encodeURIComponent(orderId)}/cancel`, { method: "POST" });
    return toActionResult(response);
  } catch {
    return { ok: false, status: 0, code: "NETWORK_ERROR" };
  }
}

export type SaveAddressResult = { ok: true; user: AuthUser } | { ok: false; code: string; fields: Record<string, string> };

export async function fetchMyOrders(page: number, size = 10): Promise<OrderPage> {
  const response = await authFetch(`/api/orders?page=${page}&size=${size}`);
  return parse<OrderPage>(response);
}

export async function fetchDelivery(orderId: string): Promise<Delivery | null> {
  const response = await authFetch(`/api/deliveries/${encodeURIComponent(orderId)}`);
  if (response.status === 404) {
    return null;
  }
  return parse<Delivery>(response);
}

export async function saveShippingAddress(address: ShippingAddress): Promise<SaveAddressResult> {
  try {
    const response = await authFetch("/api/auth/me/shipping-address", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address)
    });
    if (response.ok) {
      return { ok: true, user: (await response.json()) as AuthUser };
    }
    const body = (await response.json().catch(() => ({}))) as { code?: string; fields?: Record<string, string> };
    return { ok: false, code: body.code ?? "UNKNOWN", fields: body.fields ?? {} };
  } catch {
    return { ok: false, code: "NETWORK_ERROR", fields: {} };
  }
}
