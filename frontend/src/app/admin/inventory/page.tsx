"use client";

import { useCallback } from "react";
import { EmptyState, PageHeader } from "@/components/admin/AdminParts";
import { ProductEditor } from "@/components/admin/ProductEditor";
import { usePolling } from "@/hooks/usePolling";
import { adminApi } from "@/lib/adminApi";
import { fetchSession } from "@/lib/api";
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";

const REFRESH_MS = 5000;

export default function AdminInventoryPage() {
  useI18n();
  const load = useCallback(async () => {
    const [products, session] = await Promise.all([adminApi.products(), fetchSession().catch(() => null)]);
    return { products, session };
  }, []);
  const { data, failed, updatedAt, refresh } = usePolling(load, REFRESH_MS, "inventory");

  return (
    <div className="space-y-5">
      <PageHeader
        title={t("admin.inventory.title")}
        description={t("admin.inventory.description")}
        updatedAt={updatedAt}
        failed={failed}
        onRefresh={refresh}
      />
      {data === null && !failed && <div className="h-56 animate-pulse rounded-[16px] bg-white motion-reduce:animate-none" />}
      {data !== null && data.products.length === 0 && <EmptyState>{t("admin.inventory.empty")}</EmptyState>}
      {data?.products.map((product) => (
        <ProductEditor
          key={product.productId}
          product={product}
          productName={data.session?.productId === product.productId ? data.session.productName : t("common.product")}
          onSaved={refresh}
        />
      ))}
    </div>
  );
}
