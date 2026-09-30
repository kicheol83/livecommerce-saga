import { t } from "@/i18n/core";

type QuantityStepperProps = {
  value: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
};

export function QuantityStepper({ value, max, disabled, onChange }: QuantityStepperProps) {
  const buttonClass =
    "grid h-full w-11 place-items-center text-xl font-semibold text-pine transition-opacity disabled:opacity-30";

  return (
    <div className="flex h-[52px] shrink-0 items-center rounded-[14px] border border-frost-300 bg-white">
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= 1}
        aria-label={t("live.quantity.decrease")}
      >
        −
      </button>
      <span className="w-6 text-center text-[16px] font-bold tabular-nums" aria-live="polite" aria-label={t("live.quantity.value", { count: value })}>
        {value}
      </span>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={t("live.quantity.increase")}
      >
        +
      </button>
    </div>
  );
}
