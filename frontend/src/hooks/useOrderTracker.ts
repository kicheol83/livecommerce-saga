"use client";

import { useEffect, useRef, useState } from "react";
import { fetchOrder } from "@/lib/api";
import { ORDER_SOCKET_URL } from "@/lib/config";
import { isNewer, isTerminal } from "@/lib/orderProgress";
import type { OrderSnapshot, OrderStatus } from "@/lib/types";

type StatusMessage = {
  orderId: string;
  status: OrderStatus;
  reason: string | null;
  amount: number | null;
  paymentDeadline: string | null;
};

const POLL_INTERVAL_MS = 3000;
const MAX_RETRY_DELAY_MS = 15000;

export function useOrderTracker(orderId: string | null, initial: OrderSnapshot | null): OrderSnapshot | null {
  const [snapshot, setSnapshot] = useState<OrderSnapshot | null>(initial);
  const terminalRef = useRef(false);

  useEffect(() => {
    setSnapshot(initial);
    terminalRef.current = initial !== null && isTerminal(initial.status);
  }, [initial]);

  useEffect(() => {
    if (orderId === null) {
      return;
    }
    let socket: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    let disposed = false;

    const apply = (next: OrderSnapshot) => {
      if (disposed || next.orderId !== orderId) {
        return;
      }
      setSnapshot((current) => (isNewer(next, current) ? next : current));
      if (isTerminal(next.status)) {
        terminalRef.current = true;
      }
    };

    const sync = () => {
      if (terminalRef.current) {
        return;
      }
      fetchOrder(orderId).then(apply).catch(() => undefined);
    };

    const connect = () => {
      if (disposed || terminalRef.current) {
        return;
      }
      socket = new WebSocket(`${ORDER_SOCKET_URL}?orderId=${encodeURIComponent(orderId)}`);
      socket.onopen = () => {
        attempt = 0;
        sync();
      };
      socket.onmessage = (event: MessageEvent<string>) => {
        const message = JSON.parse(event.data) as StatusMessage;
        apply({
          orderId: message.orderId,
          status: message.status,
          failureReason: message.reason,
          amount: message.amount,
          paymentDeadline: message.paymentDeadline,
          quantity: null
        });
      };
      socket.onclose = () => {
        if (disposed || terminalRef.current) {
          return;
        }
        attempt += 1;
        retryTimer = setTimeout(connect, Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS));
      };
    };

    connect();
    const pollTimer = setInterval(sync, POLL_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(pollTimer);
      if (retryTimer !== undefined) {
        clearTimeout(retryTimer);
      }
      socket?.close();
    };
  }, [orderId]);

  return snapshot;
}
