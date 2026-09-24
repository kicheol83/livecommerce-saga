"use client";

import { Client, ReconnectionTimeMode } from "@stomp/stompjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/authStore";
import { LIVE_SOCKET_URL, LIVE_TOPICS } from "@/lib/config";
import type { ChatMessage, ConnectionState, StockChanged } from "@/lib/types";

type LiveHandlers = {
  onChat: (message: ChatMessage) => void;
  onStock: (event: StockChanged) => void;
  onViewers: (count: number) => void;
};

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15000;
const HEARTBEAT_MS = 10000;

export function useLiveChannel(handlers: LiveHandlers, userId: string | null) {
  const [state, setState] = useState<ConnectionState>("connecting");
  const handlersRef = useRef(handlers);
  const clientRef = useRef<Client | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    const client = new Client({
      brokerURL: LIVE_SOCKET_URL,
      reconnectDelay: INITIAL_RECONNECT_DELAY_MS,
      maxReconnectDelay: MAX_RECONNECT_DELAY_MS,
      reconnectTimeMode: ReconnectionTimeMode.EXPONENTIAL,
      heartbeatIncoming: HEARTBEAT_MS,
      heartbeatOutgoing: HEARTBEAT_MS,
      beforeConnect: (current) => {
        const token = getAccessToken();
        current.connectHeaders = token === null ? {} : { Authorization: `Bearer ${token}` };
      },
      onConnect: () => {
        setState("open");
        client.subscribe(LIVE_TOPICS.chat, (frame) => {
          handlersRef.current.onChat(JSON.parse(frame.body) as ChatMessage);
        });
        client.subscribe(LIVE_TOPICS.stock, (frame) => {
          handlersRef.current.onStock(JSON.parse(frame.body) as StockChanged);
        });
        client.subscribe(LIVE_TOPICS.viewers, (frame) => {
          const payload = JSON.parse(frame.body) as { count: number };
          handlersRef.current.onViewers(payload.count);
        });
      },
      onWebSocketClose: () => {
        setState("reconnecting");
      },
      onStompError: () => {
        setState("reconnecting");
      }
    });
    clientRef.current = client;
    client.activate();
    setState("connecting");
    return () => {
      clientRef.current = null;
      void client.deactivate();
    };
  }, [userId]);

  const sendChat = useCallback((text: string): boolean => {
    const client = clientRef.current;
    if (client === null || !client.connected) {
      return false;
    }
    client.publish({
      destination: LIVE_TOPICS.sendChat,
      body: JSON.stringify({ text })
    });
    return true;
  }, []);

  return { state, sendChat };
}
