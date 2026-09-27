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

export type ShippingAddress = {
  recipientName: string;
  phone: string;
  zipCode: string;
  address1: string;
  address2: string | null;
};

export type MyOrder = {
  orderId: string;
  productId: string;
  status: OrderStatus;
  quantity: number;
  amount: number | null;
  paymentDeadline: string | null;
  failureReason: string | null;
  shippingAddress: ShippingAddress | null;
  createdAt: string;
};

export type OrderPage = {
  items: MyOrder[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};

export type DeliveryStatus = "PREPARING" | "SHIPPED" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED";

export type TrackingEvent = {
  eventId: string;
  status: DeliveryStatus;
  location: string;
  description: string;
  occurredAt: string;
};

export type Delivery = {
  orderId: string;
  status: DeliveryStatus;
  carrier: string;
  trackingNumber: string;
  recipientName: string;
  address: string;
  orderedAt: string;
  deliveredAt: string | null;
  events: TrackingEvent[];
};
