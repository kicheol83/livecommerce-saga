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
  | "AWAITING_STOCK"
  | "AWAITING_PAYMENT"
  | "PAYMENT_CONFIRMING"
  | "CONFIRMING_STOCK"
  | "COMPLETED"
  | "COMPENSATING"
  | "CANCELLED";

export type OrderSnapshot = {
  orderId: string;
  status: OrderStatus;
  failureReason: string | null;
  amount: number | null;
  paymentDeadline: string | null;
  quantity: number | null;
};

export type ConnectionState = "connecting" | "open" | "reconnecting";
