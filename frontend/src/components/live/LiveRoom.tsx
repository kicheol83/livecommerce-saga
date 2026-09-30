"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCountdown } from "@/hooks/useCountdown";
import { useLiveChannel } from "@/hooks/useLiveChannel";
import { useOrderTracker } from "@/hooks/useOrderTracker";
import { cancelOrder, createOrder, fetchChatHistory, fetchOrder, fetchSession } from "@/lib/api";
import { logout, updateCurrentUser, type AuthUser } from "@/lib/authStore";
import { MAX_ORDER_QUANTITY } from "@/lib/config";
import { isTerminal } from "@/lib/orderProgress";
import type { ChatMessage, LiveSession, OrderSnapshot, ShippingAddress, StockChanged } from "@/lib/types";
import { ChatComposer } from "./ChatComposer";
import { AccountMenu } from "./AccountMenu";
import { AddressSheet } from "./AddressSheet";
import { ChatFeed } from "./ChatFeed";
import { LiveHeader } from "./LiveHeader";
import { LiveStage } from "./LiveStage";
import { OrderSheet } from "./OrderSheet";
import { ProductPanel } from "./ProductPanel";
import { ConnectionNotice, SessionError, SessionSkeleton, Toast } from "./StatusOverlays";
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";

type LoadState = "loading" | "ready" | "error";
type OrderPhase = "idle" | "address" | "submitting" | "tracking";

const CHAT_HISTORY_LIMIT = 50;
const TOAST_DURATION_MS = 3500;

export function LiveRoom() {
  useI18n();
  const router = useRouter();
  const resumeOrderId = useSearchParams().get("order");
  const auth = useAuth();
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
  const [cancelling, setCancelling] = useState(false);
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

  const channel = useLiveChannel(handlers, auth.user?.userId ?? null);
  const remaining = useCountdown(session?.endsAt ?? null, () => {
    void loadSession();
  });
  const tracked = useOrderTracker(createdOrder?.orderId ?? null, createdOrder);

  const maxQuantity = Math.max(1, Math.min(MAX_ORDER_QUANTITY, stock ?? MAX_ORDER_QUANTITY));

  useEffect(() => {
    setQuantity((current) => Math.min(current, maxQuantity));
  }, [maxQuantity]);

  const startOrder = useCallback(
    async (shippingAddress: ShippingAddress) => {
      if (session === null) {
        return;
      }
      setOrderedQuantity(quantity);
      setCreatedOrder(null);
      setOrderPhase("submitting");
      try {
        const order = await createOrder({ productId: session.productId, quantity, shippingAddress });
        setCreatedOrder(order);
        setOrderPhase("tracking");
      } catch {
        setOrderPhase("idle");
        setToast(t("live.toast.orderFailed"));
      }
    },
    [quantity, session]
  );

  const handleBuy = useCallback(async () => {
    if (session === null || orderPhase !== "idle" || auth.status === "loading") {
      return;
    }
    if (auth.status !== "authenticated" || auth.user === null) {
      router.push("/login?next=/");
      return;
    }
    if (auth.user.shippingAddress === null) {
      setOrderPhase("address");
      return;
    }
    await startOrder(auth.user.shippingAddress);
  }, [auth.status, auth.user, orderPhase, router, session, startOrder]);

  const handleAddressSaved = useCallback(
    (user: AuthUser) => {
      updateCurrentUser(user);
      setOrderPhase("idle");
      if (user.shippingAddress !== null) {
        void startOrder(user.shippingAddress);
      }
    },
    [startOrder]
  );

  const handleCloseSheet = useCallback(() => {
    setOrderPhase("idle");
    setCreatedOrder(null);
  }, []);

  const trackedOrderId = tracked?.orderId ?? null;

  const handleCancelOrder = useCallback(async () => {
    if (trackedOrderId === null || cancelling) {
      return;
    }
    setCancelling(true);
    const result = await cancelOrder(trackedOrderId);
    setCancelling(false);
    if (result.ok) {
      setOrderPhase("idle");
      setCreatedOrder(null);
      setToast(t("live.toast.orderCancelled"));
    } else {
      setToast(t("live.toast.cancelFailed"));
    }
  }, [cancelling, trackedOrderId]);

  useEffect(() => {
    if (resumeOrderId === null || auth.status !== "authenticated") {
      return;
    }
    router.replace("/");
    fetchOrder(resumeOrderId)
      .then((order) => {
        if (!isTerminal(order.status)) {
          setOrderedQuantity(order.quantity ?? 1);
          setCreatedOrder(order);
          setOrderPhase("tracking");
        }
      })
      .catch(() => setToast(t("live.toast.orderLoadFailed")));
  }, [auth.status, resumeOrderId, router]);

  const { sendChat } = channel;
  const handleSendChat = useCallback(
    (text: string) => {
      const sent = sendChat(text);
      if (!sent) {
        setToast(t("live.toast.chatDisconnected"));
      }
      return sent;
    },
    [sendChat]
  );

  const handleLogout = useCallback(() => {
    void logout().then(() => setToast(t("live.toast.loggedOut")));
  }, []);

  const chatMode = auth.status !== "authenticated" ? "guest" : channel.state === "open" ? "ready" : "connecting";

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
            <section className="relative min-h-0 flex-1" aria-label={t("live.broadcast")}>
              <LiveStage hostName={session.hostName} />
              <LiveHeader
                hostName={session.hostName}
                title={session.title}
                viewers={viewers}
                account={<AccountMenu auth={auth} onLogout={handleLogout} />}
              />
              <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/50 to-transparent px-4 pb-3 pt-10">
                <ChatFeed messages={messages} nickname={auth.user?.nickname ?? null} />
                <ChatComposer mode={chatMode} onSend={handleSendChat} />
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
              busy={orderPhase !== "idle" || auth.status === "loading"}
              requiresLogin={auth.status === "anonymous"}
              onQuantityChange={setQuantity}
              onBuy={() => {
                void handleBuy();
              }}
            />
            {orderPhase === "address" && <AddressSheet onSaved={handleAddressSaved} onClose={handleCloseSheet} />}
            {(orderPhase === "submitting" || orderPhase === "tracking") && (
              <OrderSheet
                snapshot={orderPhase === "submitting" ? null : tracked}
                productName={session.productName}
                quantity={orderedQuantity}
                user={auth.user}
                cancelling={cancelling}
                onCancelOrder={() => {
                  void handleCancelOrder();
                }}
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
