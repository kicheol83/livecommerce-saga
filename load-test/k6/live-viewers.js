import { sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { WebSocket } from "k6/websockets";
import { WS_URL, cancelOrder, createOrder, createUsers, waitForStatus } from "./lib/api.js";

const VIEWERS = Number(__ENV.VIEWERS || 300);
const HOLD_SECONDS = Number(__ENV.HOLD_SECONDS || 60);
const RAMP_SECONDS = 30;
const NUL = "\u0000";

const stompConnected = new Rate("stomp_connected");
const timeToConnected = new Trend("time_to_stomp_connected", true);
const stockUpdatesReceived = new Counter("stock_updates_received");
const viewerUpdatesReceived = new Counter("viewer_updates_received");
const stockChangesEmitted = new Counter("stock_changes_emitted");

export const options = {
  setupTimeout: "120s",
  scenarios: {
    viewers: {
      executor: "ramping-vus",
      exec: "viewer",
      startVUs: 0,
      stages: [
        { duration: `${RAMP_SECONDS}s`, target: VIEWERS },
        { duration: `${HOLD_SECONDS}s`, target: VIEWERS },
        { duration: "5s", target: 0 }
      ],
      gracefulRampDown: "10s"
    },
    buyers: {
      executor: "constant-arrival-rate",
      exec: "buyer",
      rate: 2,
      timeUnit: "1s",
      startTime: `${RAMP_SECONDS}s`,
      duration: `${HOLD_SECONDS}s`,
      preAllocatedVUs: 10,
      maxVUs: 30
    }
  },
  thresholds: {
    stomp_connected: ["rate>0.99"],
    time_to_stomp_connected: ["p(95)<1000"]
  }
};

function frame(command, headers) {
  const lines = Object.entries(headers).map(([key, value]) => `${key}:${value}`);
  return `${command}\n${lines.join("\n")}\n\n${NUL}`;
}

export function setup() {
  return { users: createUsers(5) };
}

export function viewer() {
  const openedAt = Date.now();
  let connected = false;
  let recorded = false;
  const socket = new WebSocket(`${WS_URL}/ws/live`);
  const recordFailure = () => {
    if (!recorded) {
      recorded = true;
      stompConnected.add(false);
    }
  };

  socket.onopen = () => {
    socket.send(frame("CONNECT", { "accept-version": "1.2", "heart-beat": "0,0" }));
  };
  socket.onmessage = (event) => {
    const text = String(event.data);
    if (text.startsWith("CONNECTED")) {
      connected = true;
      recorded = true;
      stompConnected.add(true);
      timeToConnected.add(Date.now() - openedAt);
      socket.send(frame("SUBSCRIBE", { id: "stock", destination: "/topic/live/stock" }));
      socket.send(frame("SUBSCRIBE", { id: "viewers", destination: "/topic/live/viewers" }));
    } else if (text.startsWith("MESSAGE")) {
      if (text.includes("destination:/topic/live/stock")) {
        stockUpdatesReceived.add(1);
      } else {
        viewerUpdatesReceived.add(1);
      }
    }
  };
  socket.onerror = () => {
    recordFailure();
    socket.close();
  };
  socket.onclose = () => {
    if (!connected) {
      recordFailure();
    }
  };
  setTimeout(() => {
    socket.close();
  }, (HOLD_SECONDS + RAMP_SECONDS) * 1000);
}

export function buyer(data) {
  const token = data.users[Math.floor(Math.random() * data.users.length)];
  const created = createOrder(token, 1);
  if (created.status !== 201) {
    return;
  }
  const orderId = created.json("orderId");
  const payable = waitForStatus(token, orderId, ["AWAITING_PAYMENT", "CANCELLED"], 10);
  if (payable === null || payable.status !== "AWAITING_PAYMENT") {
    return;
  }
  stockChangesEmitted.add(1);
  if (cancelOrder(token, orderId).status === 200) {
    stockChangesEmitted.add(1);
  }
  sleep(0.1);
}
