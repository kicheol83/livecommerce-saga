import { authFetch } from "./authStore";
import type { ChatMessage, LiveSession, OrderSnapshot, OrderStatus } from "./types";

type OrderResponse = {
  orderId: string;
  status: OrderStatus;
  amount: number;
  failureReason: string | null;
};

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
    failureReason: response.failureReason
  };
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
  amount: number;
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
