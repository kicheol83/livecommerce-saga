import http from "k6/http";
import { fail, sleep } from "k6";

export const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";
export const WS_URL = BASE_URL.replace(/^http/, "ws");
export const PRODUCT_ID = __ENV.PRODUCT_ID || "11111111-1111-1111-1111-111111111111";
export const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || "admin@livecommerce.local";
export const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || "admin1234!";
export const UNIT_PRICE = Number(__ENV.UNIT_PRICE || 39000);

export const SHIPPING_ADDRESS = {
  recipientName: "부하테스트",
  phone: "010-1234-5678",
  zipCode: "04799",
  address1: "서울특별시 성동구 성수이로 113",
  address2: "3층"
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export function params(token, name) {
  const headers = token ? { ...JSON_HEADERS, Authorization: `Bearer ${token}` } : JSON_HEADERS;
  return { headers, tags: { name } };
}

export function runId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 6; i += 1) {
    id += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return id;
}

export function login(email, password) {
  const response = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), params(null, "login"));
  if (response.status !== 200) {
    fail(`login failed for ${email}: ${response.status} ${response.body}`);
  }
  return response.json("accessToken");
}

export function signup(run, index) {
  const body = {
    email: `k6-${run}-${index}@load.test`,
    password: `k6-password-${run}`,
    nickname: `k6_${run}_${index}`
  };
  const response = http.post(`${BASE_URL}/api/auth/signup`, JSON.stringify(body), params(null, "signup"));
  if (response.status !== 201) {
    fail(`signup failed: ${response.status} ${response.body}`);
  }
  return response.json("accessToken");
}

export function createUsers(count) {
  const run = runId();
  const tokens = [];
  for (let i = 0; i < count; i += 1) {
    tokens.push(signup(run, i));
  }
  return tokens;
}

export function createOrder(token, quantity) {
  const body = { productId: PRODUCT_ID, quantity, shippingAddress: SHIPPING_ADDRESS };
  return http.post(`${BASE_URL}/api/orders`, JSON.stringify(body), params(token, "create_order"));
}

export function getOrder(token, orderId) {
  const response = http.get(`${BASE_URL}/api/orders/${orderId}`, params(token, "get_order"));
  return response.status === 200 ? response.json() : null;
}

export function waitForStatus(token, orderId, targets, timeoutSeconds, intervalSeconds = 0.25) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  while (Date.now() < deadline) {
    const order = getOrder(token, orderId);
    if (order !== null && targets.includes(order.status)) {
      return order;
    }
    sleep(intervalSeconds);
  }
  return null;
}

export function submitPayment(token, orderId, amount) {
  const body = { paymentKey: `fake_approve_${orderId}`, amount };
  return http.post(`${BASE_URL}/api/orders/${orderId}/payment`, JSON.stringify(body), params(token, "submit_payment"));
}

export function cancelOrder(token, orderId) {
  return http.post(`${BASE_URL}/api/orders/${orderId}/cancel`, null, params(token, "cancel_order"));
}

export function getDelivery(token, orderId) {
  const response = http.get(`${BASE_URL}/api/deliveries/${orderId}`, params(token, "get_delivery"));
  return response.status === 200 ? response.json() : null;
}

export function adminProduct(token) {
  const response = http.get(`${BASE_URL}/api/admin/inventory/products`, params(token, "admin_products"));
  if (response.status !== 200) {
    fail(`admin products failed: ${response.status}`);
  }
  return response.json().find((product) => product.productId === PRODUCT_ID);
}

export function setProduct(token, quantityAvailable) {
  const body = { quantityAvailable, unitPrice: UNIT_PRICE };
  const response = http.put(`${BASE_URL}/api/admin/inventory/products/${PRODUCT_ID}`, JSON.stringify(body), params(token, "admin_set_product"));
  if (response.status !== 200) {
    fail(`could not set stock: ${response.status} ${response.body}`);
  }
}

export function orderSummary(token) {
  return http.get(`${BASE_URL}/api/admin/orders/summary`, params(token, "admin_order_summary")).json();
}

export function paymentSummary(token) {
  return http.get(`${BASE_URL}/api/admin/payments/summary`, params(token, "admin_payment_summary")).json();
}
