"use client";

import { useCallback } from "react";
import { EmptyState, PageHeader } from "@/components/admin/AdminParts";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { usePolling } from "@/hooks/usePolling";
import { adminApi } from "@/lib/adminApi";
import { fetchSession } from "@/lib/api";

const REFRESH_MS = 5000;

export default function AdminInventoryPage() {
  const load = useCallback(async () => {
    const [products, session] = await Promise.all([adminApi.products(), fetchSession().catch(() => null)]);
    return { products, session };
  }, []);
  const { data, failed, updatedAt, refresh } = usePolling(load, REFRESH_MS, "inventory");

  return (
    <div className="space-y-5">
      <PageHeader
        title="재고"
        description="판매 가능 수량과 판매가를 관리해요. 결제 대기 중인 확보 수량은 판매 가능 수량에 포함되지 않아요."
        updatedAt={updatedAt}
        failed={failed}
        onRefresh={refresh}
      />
      {data === null && !failed && <div className="h-56 animate-pulse rounded-[16px] bg-white motion-reduce:animate-none" />}
      {data !== null && data.products.length === 0 && <EmptyState>등록된 상품이 없어요.</EmptyState>}
      {data?.products.map((product) => (
        <ProductEditor
          key={product.productId}
          product={product}
          productName={data.session?.productId === product.productId ? data.session.productName : "상품"}
          onSaved={refresh}
        />
      ))}
    </div>
  );
}
