"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { ShippingAddressForm } from "@/components/shipping/ShippingAddressForm";
import { useAuth } from "@/hooks/useAuth";
import { usePolling } from "@/hooks/usePolling";
import { fetchMyOrders, fetchSession } from "@/lib/api";
import { updateCurrentUser, type AuthUser } from "@/lib/authStore";
import { formatDateTime, formatWon } from "@/lib/format";
import { failureMessage } from "@/lib/orderProgress";
import { addressLine } from "@/lib/shipping";
import type { MyOrder, OrderStatus } from "@/lib/types";
import { DeliveryTracker } from "./DeliveryTracker";

const PAGE_SIZE = 10;
const REFRESH_MS = 10000;

const BUYER_STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  AWAITING_STOCK: { label: "주문 접수", tone: "bg-mustard/20 text-[#7A5510]" },
  AWAITING_PAYMENT: { label: "결제 대기", tone: "bg-mustard/20 text-[#7A5510]" },
  PAYMENT_CONFIRMING: { label: "결제 확인 중", tone: "bg-mustard/20 text-[#7A5510]" },
  CONFIRMING_STOCK: { label: "결제 확인 중", tone: "bg-mustard/20 text-[#7A5510]" },
  COMPLETED: { label: "결제 완료", tone: "bg-[#DCEEE4] text-[#1D5A43]" },
  COMPENSATING: { label: "환불 중", tone: "bg-cranberry/10 text-cranberry" },
  CANCELLED: { label: "주문 취소", tone: "bg-ash/15 text-ash" }
};

function OrderCard({ order, productName }: { order: MyOrder; productName: string }) {
  const status = BUYER_STATUS[order.status];
  return (
    <li className="rounded-[16px] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-ash tabular-nums">{formatDateTime(order.createdAt)}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${status.tone}`}>{status.label}</span>
      </div>
      <p className="mt-2 text-[16px] font-semibold">
        {productName} <span className="font-normal text-ash">{order.quantity}개</span>
      </p>
      <p className="mt-0.5 text-[15px] font-bold tabular-nums">{order.amount === null ? "금액 확정 전" : formatWon(order.amount)}</p>
      {order.status === "CANCELLED" && <p className="mt-2 text-[13px] leading-relaxed text-ash">{failureMessage(order.failureReason)}</p>}
      {order.status === "AWAITING_PAYMENT" && (
        <Link
          href={`/?order=${encodeURIComponent(order.orderId)}`}
          className="mt-3 flex h-11 items-center justify-center rounded-[12px] bg-cranberry text-[14px] font-bold text-white"
        >
          결제 이어서 하기
        </Link>
      )}
      {order.status === "COMPLETED" && <DeliveryTracker orderId={order.orderId} />}
    </li>
  );
}

export function MyPage() {
  const auth = useAuth();
  const router = useRouter();
  const [editingAddress, setEditingAddress] = useState(false);
  const [olderOrders, setOlderOrders] = useState<MyOrder[]>([]);
  const [nextPage, setNextPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [productName, setProductName] = useState("상품");

  useEffect(() => {
    if (auth.status === "anonymous") {
      router.replace("/login?next=/me");
    }
  }, [auth.status, router]);

  useEffect(() => {
    fetchSession()
      .then((session) => setProductName(session.productName))
      .catch(() => undefined);
  }, []);

  const loadFirstPage = useCallback(() => fetchMyOrders(0, PAGE_SIZE), []);
  const { data: firstPage, failed } = usePolling(loadFirstPage, REFRESH_MS, auth.user?.userId ?? "anonymous");

  const loadMore = async () => {
    setLoadingMore(true);
    const page = await fetchMyOrders(nextPage, PAGE_SIZE).catch(() => null);
    setLoadingMore(false);
    if (page !== null) {
      setOlderOrders((current) => [...current, ...page.items]);
      setNextPage((current) => current + 1);
    }
  };

  if (auth.status !== "authenticated" || auth.user === null) {
    return <div className="min-h-[100dvh] bg-pine" aria-busy="true" />;
  }

  const user = auth.user;
  const orders = [...(firstPage?.items ?? []), ...olderOrders];
  const hasMore = firstPage !== null && nextPage < firstPage.totalPages;

  const handleSaved = (updated: AuthUser) => {
    updateCurrentUser(updated);
    setEditingAddress(false);
  };

  return (
    <AuthShell title="내 주문" description={`${user.nickname}님의 주문과 배송 현황이에요.`}>
      <section aria-labelledby="address-title" className="rounded-[16px] bg-white p-4">
        <div className="flex items-center justify-between">
          <h2 id="address-title" className="text-[15px] font-bold">
            기본 배송지
          </h2>
          {!editingAddress && (
            <button
              type="button"
              onClick={() => setEditingAddress(true)}
              className="text-[13px] font-semibold text-pine underline underline-offset-4"
            >
              {user.shippingAddress === null ? "등록" : "변경"}
            </button>
          )}
        </div>
        {editingAddress ? (
          <div className="mt-4">
            <ShippingAddressForm
              initial={user.shippingAddress}
              submitLabel="저장"
              onSaved={handleSaved}
              onCancel={() => setEditingAddress(false)}
            />
          </div>
        ) : user.shippingAddress === null ? (
          <p className="mt-2 text-[14px] text-ash">아직 등록된 배송지가 없어요. 첫 주문 때 입력해도 돼요.</p>
        ) : (
          <div className="mt-2 text-[14px] leading-relaxed">
            <p className="font-semibold">
              {user.shippingAddress.recipientName} <span className="font-normal text-ash tabular-nums">{user.shippingAddress.phone}</span>
            </p>
            <p className="text-ash">
              ({user.shippingAddress.zipCode}) {addressLine(user.shippingAddress)}
            </p>
          </div>
        )}
      </section>

      <section aria-labelledby="orders-title" className="mt-6">
        <h2 id="orders-title" className="text-[15px] font-bold">
          주문 내역
        </h2>
        {failed && firstPage === null && <p className="mt-3 text-[14px] text-cranberry">주문 내역을 불러오지 못했어요.</p>}
        {firstPage === null && !failed && (
          <div className="mt-3 h-40 animate-pulse rounded-[16px] bg-white motion-reduce:animate-none" />
        )}
        {firstPage !== null && orders.length === 0 && (
          <div className="mt-3 rounded-[16px] bg-white p-6 text-center">
            <p className="text-[14px] text-ash">아직 주문한 상품이 없어요.</p>
            <Link href="/" className="mt-3 inline-flex h-10 items-center rounded-full bg-pine px-5 text-[14px] font-semibold text-frost">
              라이브 보러 가기
            </Link>
          </div>
        )}
        <ul className="mt-3 space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.orderId} order={order} productName={productName} />
          ))}
        </ul>
        {hasMore && (
          <button
            type="button"
            onClick={() => {
              void loadMore();
            }}
            disabled={loadingMore}
            className="mt-4 h-11 w-full rounded-[12px] border border-frost-300 bg-white text-[14px] font-semibold text-pine disabled:opacity-50"
          >
            {loadingMore ? "불러오는 중" : "이전 주문 더 보기"}
          </button>
        )}
      </section>
    </AuthShell>
  );
}
