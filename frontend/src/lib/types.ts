export type LiveSession = {
  sessionId: string;
  title: string;
  hostName: string;
  productId: string;
  productName: string;
  price: number;
  originalPrice: number;
  stock: number | null;
  endsAt: string;
  viewerCount: number;
};

export type ChatMessage = {
  id: string;
  author: string;
  text: string;
  sentAt: string;
};

export type StockChanged = {
  productId: string;
  quantityAvailable: number;
};

export type OrderStatus =
  | "CREATED"
  | "AWAITING_PAYMENT"
  | "PAYMENT_CONFIRMED"
  | "AWAITING_INVENTORY"
  | "COMPLETED"
  | "COMPENSATING"
  | "CANCELLED";

export type OrderSnapshot = {
  orderId: string;
  status: OrderStatus;
  failureReason: string | null;
};

export type ConnectionState = "connecting" | "open" | "reconnecting";
