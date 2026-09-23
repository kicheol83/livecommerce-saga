import type { ProgressStep, StepState } from "@/lib/orderProgress";
import { CheckIcon, CrossIcon } from "./Icons";

type SagaStepperProps = {
  steps: ProgressStep[];
};

const STATE_TEXT: Record<StepState, string> = {
  done: "완료",
  active: "진행 중",
  pending: "대기",
  failed: "실패"
};

const LABEL_CLASS: Record<StepState, string> = {
  done: "font-semibold text-pine",
  active: "font-semibold text-pine",
  pending: "text-ash",
  failed: "font-semibold text-cranberry"
};

function Marker({ state, index }: { state: StepState; index: number }) {
  if (state === "done") {
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-pine text-frost">
        <CheckIcon className="h-4 w-4" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="grid h-7 w-7 place-items-center rounded-full bg-cranberry text-white">
        <CrossIcon className="h-4 w-4" />
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative grid h-7 w-7 place-items-center rounded-full border-2 border-cranberry bg-white">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-cranberry motion-reduce:animate-none" />
      </span>
    );
  }
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-frost-300 bg-white text-[12px] font-semibold text-ash">
      {index + 1}
    </span>
  );
}

export function SagaStepper({ steps }: SagaStepperProps) {
  return (
    <ol className="mt-5" aria-label="주문 진행 단계">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li key={step.label} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && (
              <span
                className={`absolute left-[13px] top-7 h-[calc(100%-28px)] w-0.5 ${
                  step.state === "done" ? "bg-pine" : "bg-frost-300"
                }`}
                aria-hidden="true"
              />
            )}
            <Marker state={step.state} index={index} />
            <div className="flex min-h-7 items-center gap-2">
              <span className={`text-[15px] ${LABEL_CLASS[step.state]}`}>
                {step.label}
              </span>
              <span className="sr-only">{STATE_TEXT[step.state]}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
