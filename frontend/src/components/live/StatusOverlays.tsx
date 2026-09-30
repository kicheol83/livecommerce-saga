import type { ConnectionState } from "@/lib/types";
import { t } from "@/i18n/core";

export function ConnectionNotice({ state }: { state: ConnectionState }) {
  if (state !== "reconnecting") {
    return null;
  }
  return (
    <p role="status" className="absolute inset-x-0 top-0 z-20 bg-mustard px-4 py-2 text-center text-[13px] font-semibold text-pine">
      {t("live.connectionLost")}
    </p>
  );
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-20 z-40 flex justify-center px-6" role="status" aria-live="polite">
      {message !== null && (
        <p className="animate-fade_in rounded-full bg-pine px-4 py-2.5 text-center text-[14px] font-medium text-frost shadow-lg">
          {message}
        </p>
      )}
    </div>
  );
}

export function SessionSkeleton() {
  return (
    <div className="flex h-full flex-col" aria-busy="true" aria-label={t("live.session.loading")}>
      <div className="flex-1 animate-pulse bg-pine-600 motion-reduce:animate-none" />
      <div className="space-y-3 rounded-t-[22px] bg-frost px-5 pb-8 pt-5">
        <div className="h-5 w-40 rounded-md bg-frost-300" />
        <div className="h-8 w-56 rounded-md bg-frost-300" />
        <div className="h-5 w-full rounded-md bg-frost-300" />
        <div className="h-[52px] w-full rounded-[14px] bg-frost-300" />
      </div>
    </div>
  );
}

export function SessionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-frost">
      <p className="text-[17px] font-semibold">{t("live.session.failed")}</p>
      <p className="text-[14px] leading-relaxed text-frost/70">{t("common.networkError")}</p>
      <button
        type="button"
        onClick={onRetry}
        className="h-11 rounded-full bg-frost px-6 text-[15px] font-semibold text-pine"
      >
        {t("common.retry")}
      </button>
    </div>
  );
}
