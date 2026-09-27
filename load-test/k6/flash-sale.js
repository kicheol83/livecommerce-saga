import { check, sleep } from "k6";
import exec from "k6/execution";
import { Counter, Trend } from "k6/metrics";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  adminProduct,
  createOrder,
  createUsers,
  login,
  orderSummary,
  paymentSummary,
  setProduct,
  submitPayment,
  waitForStatus
} from "./lib/api.js";

const STOCK = Number(__ENV.STOCK || 100);
const BUYERS = Number(__ENV.BUYERS || 300);
const VUS = Number(__ENV.VUS || 100);
const USERS = Number(__ENV.USERS || 100);

const timeToStockHold = new Trend("time_to_stock_hold", true);
const timeToCompletion = new Trend("time_to_completion", true);
const heldOrders = new Counter("orders_stock_held");
const soldOutOrders = new Counter("orders_sold_out");
const completedOrders = new Counter("orders_completed");
const abandonedOrders = new Counter("orders_timed_out");

export const options = {
  setupTimeout: "300s",
  teardownTimeout: "120s",
  scenarios: {
    flash_sale: {
      executor: "shared-iterations",
      vus: VUS,
      iterations: BUYERS,
      maxDuration: "5m"
    }
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{name:create_order}": ["p(95)<500"],
    "http_req_duration{name:submit_payment}": ["p(95)<1000"],
    time_to_stock_hold: ["p(95)<3000"],
    time_to_completion: ["p(95)<6000"],
    "checks{phase:invariant}": ["rate==1"]
  }
};

function completedCount(summary) {
  return summary.countsByStatus.COMPLETED || 0;
}

function confirmedCount(summary) {
  return summary.countsByStatus.CONFIRMED || 0;
}

export function setup() {
  const admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
  setProduct(admin, STOCK);
  const product = adminProduct(admin);
  const before = {
    heldQuantity: product.heldQuantity,
    soldQuantity: product.soldQuantity,
    completed: completedCount(orderSummary(admin)),
    confirmed: confirmedCount(paymentSummary(admin))
  };
  return { admin, before, users: createUsers(USERS) };
}

export default function (data) {
  const token = data.users[exec.scenario.iterationInTest % data.users.length];
  const startedAt = Date.now();

  const created = createOrder(token, 1);
  if (!check(created, { "order accepted": (response) => response.status === 201 })) {
    return;
  }
  const orderId = created.json("orderId");

  const payable = waitForStatus(token, orderId, ["AWAITING_PAYMENT", "CANCELLED"], 15);
  if (payable === null) {
    abandonedOrders.add(1);
    return;
  }
  if (payable.status === "CANCELLED") {
    soldOutOrders.add(1);
    return;
  }
  heldOrders.add(1);
  timeToStockHold.add(Date.now() - startedAt);

  const payment = submitPayment(token, orderId, payable.amount);
  check(payment, { "payment accepted": (response) => response.status === 202 });

  const final = waitForStatus(token, orderId, ["COMPLETED", "CANCELLED"], 20);
  if (final !== null && final.status === "COMPLETED") {
    completedOrders.add(1);
    timeToCompletion.add(Date.now() - startedAt);
  } else {
    abandonedOrders.add(1);
  }
}

export function teardown(data) {
  sleep(3);
  const admin = login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const product = adminProduct(admin);
  const soldDelta = product.soldQuantity - data.before.soldQuantity;
  const completedDelta = completedCount(orderSummary(admin)) - data.before.completed;
  const confirmedDelta = confirmedCount(paymentSummary(admin)) - data.before.confirmed;

  console.log(
    `stock=${STOCK} sold=${soldDelta} completed=${completedDelta} charged=${confirmedDelta} ` +
      `available=${product.quantityAvailable} held=${product.heldQuantity}`
  );

  check(
    product,
    {
      "no oversell: sold units never exceed stock": () => soldDelta <= STOCK,
      "available stock never goes negative": (value) => value.quantityAvailable >= 0,
      "stock is conserved: available + held + sold equals what was put on sale": (value) =>
        value.quantityAvailable + value.heldQuantity + soldDelta === STOCK + data.before.heldQuantity,
      "every sold unit belongs to a completed order": () => soldDelta === completedDelta,
      "nobody is charged without an item: charges equal completed orders": () => confirmedDelta === completedDelta
    },
    { phase: "invariant" }
  );
}
