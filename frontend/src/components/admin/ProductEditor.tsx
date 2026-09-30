"use client";

import { useEffect, useState, type FormEvent } from "react";
import { adminApi } from "@/lib/adminApi";
import type { AdminProduct } from "@/lib/adminTypes";
import { formatCount, formatWon } from "@/lib/format";
import { t } from "@/i18n/core";

type ProductEditorProps = {
  product: AdminProduct;
  productName: string;
  onSaved: () => void;
};

export function ProductEditor({ product, productName, onSaved }: ProductEditorProps) {
  const [quantity, setQuantity] = useState(String(product.quantityAvailable));
  const [price, setPrice] = useState(String(product.unitPrice));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!dirty) {
      setQuantity(String(product.quantityAvailable));
      setPrice(String(product.unitPrice));
    }
  }, [dirty, product.quantityAvailable, product.unitPrice]);

  const parsedQuantity = Number(quantity);
  const parsedPrice = Number(price);
  const quantityError = !Number.isInteger(parsedQuantity) || parsedQuantity < 0 ? t("admin.editor.quantityError") : null;
  const priceError = !Number.isFinite(parsedPrice) || parsedPrice <= 0 ? t("admin.editor.priceError") : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (quantityError !== null || priceError !== null) {
      return;
    }
    setSaving(true);
    setMessage(null);
    const result = await adminApi.updateProduct(product.productId, parsedQuantity, parsedPrice);
    setSaving(false);
    if (result.ok) {
      setDirty(false);
      setMessage({ tone: "ok", text: t("admin.editor.saved") });
      onSaved();
    } else {
      setMessage({ tone: "error", text: t("admin.editor.saveFailed") });
    }
  };

  const edit = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setDirty(true);
    setMessage(null);
  };

  return (
    <section className="rounded-[16px] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[17px] font-bold">{productName}</h2>
          <p className="mt-0.5 text-[12px] text-ash tabular-nums">{product.productId}</p>
        </div>
        <dl className="flex gap-6 text-[13px]">
          <div>
            <dt className="text-ash">{t("admin.stock.held")}</dt>
            <dd className="mt-0.5 text-[18px] font-bold tabular-nums">
              {t("common.units", { count: formatCount(product.heldQuantity) })}
              <span className="ml-1 text-[13px] font-medium text-ash">({t("common.cases", { count: formatCount(product.heldOrders) })})</span>
            </dd>
          </div>
          <div>
            <dt className="text-ash">{t("admin.stock.sold")}</dt>
            <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{t("common.units", { count: formatCount(product.soldQuantity) })}</dd>
          </div>
          <div>
            <dt className="text-ash">{t("admin.stock.currentPrice")}</dt>
            <dd className="mt-0.5 text-[18px] font-bold tabular-nums">{formatWon(product.unitPrice)}</dd>
          </div>
        </dl>
      </div>

      <form onSubmit={handleSubmit} noValidate className="mt-5 grid gap-4 border-t border-frost-300 pt-5 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
        <div>
          <label htmlFor={`quantity-${product.productId}`} className="text-[13px] font-semibold">
            {t("admin.editor.quantity")}
          </label>
          <input
            id={`quantity-${product.productId}`}
            inputMode="numeric"
            value={quantity}
            onChange={(event) => edit(setQuantity)(event.target.value)}
            aria-invalid={quantityError !== null}
            className="mt-1.5 h-11 w-full rounded-[10px] border border-frost-300 px-3 text-[15px] tabular-nums"
          />
          {quantityError !== null && <p className="mt-1 text-[12px] text-cranberry">{quantityError}</p>}
        </div>
        <div>
          <label htmlFor={`price-${product.productId}`} className="text-[13px] font-semibold">
            {t("admin.editor.price")}
          </label>
          <input
            id={`price-${product.productId}`}
            inputMode="numeric"
            value={price}
            onChange={(event) => edit(setPrice)(event.target.value)}
            aria-invalid={priceError !== null}
            className="mt-1.5 h-11 w-full rounded-[10px] border border-frost-300 px-3 text-[15px] tabular-nums"
          />
          {priceError !== null && <p className="mt-1 text-[12px] text-cranberry">{priceError}</p>}
        </div>
        <button
          type="submit"
          disabled={!dirty || saving || quantityError !== null || priceError !== null}
          className="h-11 rounded-[10px] bg-pine px-5 text-[14px] font-semibold text-frost disabled:bg-ash/40 sm:mt-[26px]"
        >
          {saving ? t("common.saving") : t("common.save")}
        </button>
      </form>
      <p className="mt-3 text-[12px] leading-relaxed text-ash">
        {t("admin.editor.note")}
      </p>
      {message !== null && (
        <p role="status" className={`mt-2 text-[13px] font-medium ${message.tone === "ok" ? "text-pine" : "text-cranberry"}`}>
          {message.text}
        </p>
      )}
    </section>
  );
}
