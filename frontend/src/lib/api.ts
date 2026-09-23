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

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, { cache: "no-store", ...init });
  if (!response.ok) {
    throw new ApiError(response.status);
  }
  return (await response.json()) as T;
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
  memberId: string;
  productId: string;
  quantity: number;
  amount: number;
}): Promise<OrderSnapshot> {
  const response = await requestJson<OrderResponse>("/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  return toSnapshot(response);
}

export async function fetchOrder(orderId: string): Promise<OrderSnapshot> {
  const response = await requestJson<OrderResponse>(`/api/orders/${encodeURIComponent(orderId)}`);
  return toSnapshot(response);
}
