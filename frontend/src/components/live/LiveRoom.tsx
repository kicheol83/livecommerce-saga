"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCountdown } from "@/hooks/useCountdown";
import { useIdentity } from "@/hooks/useIdentity";
import { useLiveChannel } from "@/hooks/useLiveChannel";
import { useOrderTracker } from "@/hooks/useOrderTracker";
import { createOrder, fetchChatHistory, fetchSession } from "@/lib/api";
import { MAX_ORDER_QUANTITY } from "@/lib/config";
import type { ChatMessage, LiveSession, OrderSnapshot, StockChanged } from "@/lib/types";
import { ChatComposer } from "./ChatComposer";
import { ChatFeed } from "./ChatFeed";
import { LiveHeader } from "./LiveHeader";
import { LiveStage } from "./LiveStage";
import { OrderSheet } from "./OrderSheet";
import { ProductPanel } from "./ProductPanel";
import { ConnectionNotice, SessionError, SessionSkeleton, Toast } from "./StatusOverlays";

type LoadState = "loading" | "ready" | "error";
type OrderPhase = "idle" | "submitting" | "tracking";

const CHAT_HISTORY_LIMIT = 50;
const TOAST_DURATION_MS = 3500;

export function LiveRoom() {
  const identity = useIdentity();
  const [session, setSession] = useState<LiveSession | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [stock, setStock] = useState<number | null>(null);
  const [capacity, setCapacity] = useState(0);
  const [stockPulse, setStockPulse] = useState(0);
  const [viewers, setViewers] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [orderPhase, setOrderPhase] = useState<OrderPhase>("idle");
  const [createdOrder, setCreatedOrder] = useState<OrderSnapshot | null>(null);
  const [orderedQuantity, setOrderedQuantity] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const productIdRef = useRef<string | null>(null);

  const applyStock = useCallback((value: number | null) => {
    setStock(value);
    if (value !== null) {
      setCapacity((current) => Math.max(current, value));
    }
  }, []);

  const loadSession = useCallback(async () => {
    try {
      const next = await fetchSession();
      productIdRef.current = next.productId;
      setSession(next);
      applyStock(next.stock);
      setViewers(next.viewerCount);
      setLoadState("ready");
    } catch {
      setLoadState((current) => (current === "ready" ? current : "error"));
    }
  }, [applyStock]);

  useEffect(() => {
    void loadSession();
    fetchChatHistory()
      .then((history) => setMessages(history.slice(-CHAT_HISTORY_LIMIT)))
      .catch(() => undefined);
  }, [loadSession]);

  useEffect(() => {
    if (toast === null) {
      return;
    }
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const handlers = useMemo(
    () => ({
      onChat: (message: ChatMessage) => {
        setMessages((current) =>
          current.some((existing) => existing.id === message.id)
            ? current
            : [...current, message].slice(-CHAT_HISTORY_LIMIT)
        );
      },
      onStock: (event: StockChanged) => {
        if (event.productId !== productIdRef.current) {
          return;
        }
        applyStock(event.quantityAvailable);
        setStockPulse((current) => current + 1);
      },
      onViewers: (count: number) => setViewers(count)
    }),
    [applyStock]
  );

  const channel = useLiveChannel(handlers);
  const remaining = useCountdown(session?.endsAt ?? null, () => {
    void loadSession();
  });
  const tracked = useOrderTracker(createdOrder?.orderId ?? null, createdOrder);

  const maxQuantity = Math.max(1, Math.min(MAX_ORDER_QUANTITY, stock ?? MAX_ORDER_QUANTITY));

  useEffect(() => {
    setQuantity((current) => Math.min(current, maxQuantity));
  }, [maxQuantity]);

  const handleBuy = useCallback(async () => {
    if (session === null || identity === null || orderPhase !== "idle") {
      return;
    }
    setOrderedQuantity(quantity);
    setCreatedOrder(null);
    setOrderPhase("submitting");
    try {
      const order = await createOrder({
        memberId: identity.memberId,
        productId: session.productId,
        quantity,
        amount: session.price * quantity
      });
      setCreatedOrder(order);
      setOrderPhase("tracking");
    } catch {
      setOrderPhase("idle");
      setToast("주문을 접수하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  }, [identity, orderPhase, quantity, session]);

  const handleCloseSheet = useCallback(() => {
    setOrderPhase("idle");
    setCreatedOrder(null);
  }, []);

  const handleSendChat = useCallback(
    (text: string) => {
      if (identity === null) {
        return false;
      }
      const sent = channel.sendChat(identity.nickname, text);
      if (!sent) {
        setToast("채팅 연결이 끊겨 보내지 못했어요.");
      }
      return sent;
    },
    [channel, identity]
  );

  const handleRetry = useCallback(() => {
    setLoadState("loading");
    void loadSession();
  }, [loadSession]);

  return (
    <main className="knit-page flex min-h-[100dvh] justify-center md:items-center md:py-6">
      <div className="relative flex h-[100dvh] w-full max-w-[440px] flex-col overflow-hidden bg-pine md:h-[min(900px,calc(100dvh-48px))] md:rounded-[28px] md:shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
        {loadState === "loading" && <SessionSkeleton />}
        {loadState === "error" && <SessionError onRetry={handleRetry} />}
        {loadState === "ready" && session !== null && (
          <>
            <ConnectionNotice state={channel.state} />
            <section className="relative min-h-0 flex-1" aria-label="라이브 방송">
              <LiveStage hostName={session.hostName} />
              <LiveHeader hostName={session.hostName} title={session.title} viewers={viewers} />
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/50 to-transparent px-4 pb-3 pt-10">
                <ChatFeed messages={messages} nickname={identity?.nickname ?? null} />
                <ChatComposer connected={channel.state === "open"} onSend={handleSendChat} />
              </div>
            </section>
            <ProductPanel
              productName={session.productName}
              price={session.price}
              originalPrice={session.originalPrice}
              stock={stock}
              capacity={capacity}
              stockPulse={stockPulse}
              remaining={remaining}
              quantity={quantity}
              maxQuantity={maxQuantity}
              busy={orderPhase !== "idle" || identity === null}
              onQuantityChange={setQuantity}
              onBuy={() => {
                void handleBuy();
              }}
            />
            {orderPhase !== "idle" && (
              <OrderSheet
                snapshot={orderPhase === "submitting" ? null : tracked}
                productName={session.productName}
                quantity={orderedQuantity}
                onClose={handleCloseSheet}
              />
            )}
          </>
        )}
        <Toast message={toast} />
      </div>
    </main>
  );
}
