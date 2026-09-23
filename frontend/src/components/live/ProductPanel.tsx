import { discountRate, formatWon } from "@/lib/format";
import { Countdown } from "./Countdown";
import { KnitStockMeter } from "./KnitStockMeter";
import { QuantityStepper } from "./QuantityStepper";

type ProductPanelProps = {
  productName: string;
  price: number;
  originalPrice: number;
  stock: number | null;
  capacity: number;
  stockPulse: number;
  remaining: number | null;
  quantity: number;
  maxQuantity: number;
  busy: boolean;
  onQuantityChange: (value: number) => void;
  onBuy: () => void;
};

const LOW_STOCK_RATIO = 0.2;

export function ProductPanel({
  productName,
  price,
  originalPrice,
  stock,
  capacity,
  stockPulse,
  remaining,
  quantity,
  maxQuantity,
  busy,
  onQuantityChange,
  onBuy
}: ProductPanelProps) {
  const rate = discountRate(price, originalPrice);
  const soldOut = stock === 0;
  const lowStock = stock !== null && stock > 0 && capacity > 0 && stock / capacity <= LOW_STOCK_RATIO;
  const buyLabel = soldOut ? "품절" : busy ? "주문 처리 중" : `${formatWon(price * quantity)} 구매하기`;

  return (
    <section
      aria-label="상품 정보"
      className="relative z-10 shrink-0 rounded-t-[22px] bg-frost px-5 pb-[calc(16px+env(safe-area-inset-bottom))] pt-4 text-pine"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-[17px] font-semibold leading-snug">{productName}</h2>
        <Countdown remaining={remaining} />
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
        {rate > 0 && <span className="text-[26px] font-extrabold tracking-tight text-cranberry tabular-nums">{rate}%</span>}
        <span className="text-[26px] font-extrabold tracking-tight tabular-nums">{formatWon(price)}</span>
        {rate > 0 && <s className="text-[14px] text-ash tabular-nums">{formatWon(originalPrice)}</s>}
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between text-[14px]">
          {stock === null ? (
            <span className="text-ash">남은 수량을 확인하는 중이에요</span>
          ) : (
            <span aria-live="polite">
              {soldOut ? (
                "모두 판매됐어요"
              ) : (
                <>
                  남은 수량{" "}
                  <strong
                    key={stockPulse}
                    className={`inline-block font-extrabold tabular-nums ${
                      stockPulse > 0 ? "animate-pulse_once motion-reduce:animate-none" : ""
                    }`}
                  >
                    {stock}
                  </strong>
                  개
                </>
              )}
            </span>
          )}
          {lowStock && <span className="text-[13px] font-semibold text-[#8A6212]">마감 임박</span>}
        </div>
        {stock !== null && <KnitStockMeter stock={stock} capacity={capacity} />}
      </div>

      <div className="mt-4 flex gap-2">
        <QuantityStepper value={quantity} max={maxQuantity} disabled={busy || soldOut} onChange={onQuantityChange} />
        <button
          type="button"
          onClick={onBuy}
          disabled={busy || soldOut}
          className="h-[52px] flex-1 rounded-[14px] bg-cranberry text-[16px] font-bold text-white transition-colors hover:bg-cranberry-700 disabled:bg-ash/50"
        >
          {buyLabel}
        </button>
      </div>
    </section>
  );
}
