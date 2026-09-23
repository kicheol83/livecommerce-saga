import { formatRemaining } from "@/lib/format";
import { ClockIcon } from "./Icons";

type CountdownProps = {
  remaining: number | null;
};

const URGENT_MS = 60000;

export function Countdown({ remaining }: CountdownProps) {
  const urgent = remaining !== null && remaining <= URGENT_MS;
  const label = remaining === null ? "--:--" : formatRemaining(remaining);

  return (
    <span
      className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-semibold tabular-nums ${
        urgent ? "bg-mustard text-pine" : "bg-pine text-frost"
      }`}
    >
      <ClockIcon className="h-3.5 w-3.5" />
      <span>
        {label}
        <span className="sr-only"> 후 특가 종료</span>
      </span>
    </span>
  );
}
