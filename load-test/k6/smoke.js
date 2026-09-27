import { check, sleep } from "k6";
import http from "k6/http";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  BASE_URL,
  adminProduct,
  createOrder,
  createUsers,
  getDelivery,
  login,
  params,
  setProduct,
  submitPayment,
  waitForStatus
} from "./lib/api.js";

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    checks: ["rate==1"]
  }
};

export function setup() {
  const admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
  if (adminProduct(admin).quantityAvailable < 1) {
    setProduct(admin, 100);
  }
  return { token: createUsers(1)[0] };
}

export default function (data) {
  const token = data.token;
  const created = createOrder(token, 1);
  check(created, { "order accepted": (response) => response.status === 201 });
  if (created.status !== 201) {
    return;
  }
  const orderId = created.json("orderId");

  const payable = waitForStatus(token, orderId, ["AWAITING_PAYMENT", "CANCELLED"], 20);
  check(payable, {
    "stock held and waiting for payment": (order) => order !== null && order.status === "AWAITING_PAYMENT",
    "amount computed by the server": (order) => order !== null && order.amount > 0
  });
  if (payable === null || payable.status !== "AWAITING_PAYMENT") {
    return;
  }

  check(submitPayment(token, orderId, payable.amount), { "payment accepted": (response) => response.status === 202 });

  const final = waitForStatus(token, orderId, ["COMPLETED", "CANCELLED"], 30);
  check(final, { "order completed": (order) => order !== null && order.status === "COMPLETED" });

  let delivery = null;
  for (let attempt = 0; attempt < 40 && delivery === null; attempt += 1) {
    delivery = getDelivery(token, orderId);
    if (delivery === null) {
      sleep(0.5);
    }
  }
  check(delivery, { "delivery created from the completed order": (value) => value !== null && value.trackingNumber.length > 0 });

  const mine = http.get(`${BASE_URL}/api/orders`, params(token, "my_orders"));
  check(mine, { "order listed in my orders": (response) => response.json("items").some((item) => item.orderId === orderId) });
}
