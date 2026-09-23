export const LIVE_SOCKET_URL = process.env.NEXT_PUBLIC_LIVE_SOCKET_URL ?? "ws://localhost:8084/ws/live";
export const ORDER_SOCKET_URL = process.env.NEXT_PUBLIC_ORDER_SOCKET_URL ?? "ws://localhost:8081/ws/orders";
export const LIVE_VIDEO_URL = process.env.NEXT_PUBLIC_LIVE_VIDEO_URL ?? "";

export const LIVE_TOPICS = {
  chat: "/topic/live/chat",
  stock: "/topic/live/stock",
  viewers: "/topic/live/viewers",
  sendChat: "/app/live/chat"
} as const;

export const MAX_ORDER_QUANTITY = 5;
export const CHAT_VISIBLE_COUNT = 6;
export const CHAT_MAX_LENGTH = 200;
