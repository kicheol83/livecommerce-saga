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
        aria-label="수량 줄이기"
      >
        −
      </button>
      <span className="w-6 text-center text-[16px] font-bold tabular-nums" aria-live="polite" aria-label={`수량 ${value}개`}>
        {value}
      </span>
      <button
        type="button"
        className={buttonClass}
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label="수량 늘리기"
      >
        +
      </button>
    </div>
  );
}
