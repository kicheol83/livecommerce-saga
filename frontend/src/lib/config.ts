export const LIVE_SOCKET_URL = process.env.NEXT_PUBLIC_LIVE_SOCKET_URL ?? "ws://localhost:8080/ws/live";
export const ORDER_SOCKET_URL = process.env.NEXT_PUBLIC_ORDER_SOCKET_URL ?? "ws://localhost:8080/ws/orders";
export const LIVE_VIDEO_URL = process.env.NEXT_PUBLIC_LIVE_VIDEO_URL ?? "";
export const TOSS_CLIENT_KEY = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

export const LIVE_TOPICS = {
  chat: "/topic/live/chat",
  stock: "/topic/live/stock",
  viewers: "/topic/live/viewers",
  sendChat: "/app/live/chat"
} as const;

export const MAX_ORDER_QUANTITY = 5;
export const CHAT_VISIBLE_COUNT = 6;
export const CHAT_MAX_LENGTH = 200;
