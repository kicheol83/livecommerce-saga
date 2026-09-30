import type { ReactNode } from "react";
import { EyeIcon } from "./Icons";
import { t } from "@/i18n/core";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

type LiveHeaderProps = {
  hostName: string;
  title: string;
  viewers: number;
  account: ReactNode;
};

export function LiveHeader({ hostName, title, viewers, account }: LiveHeaderProps) {
  return (
    <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-2.5 bg-gradient-to-b from-black/60 to-transparent px-4 pb-10 pt-[calc(14px+env(safe-area-inset-top))] text-white">
      <div
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cranberry text-sm font-bold ring-2 ring-white/80"
        aria-hidden="true"
      >
        {hostName.slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-white/80">{hostName}</p>
        <h1 className="truncate text-[15px] font-bold leading-tight">{title}</h1>
      </div>
      <span className="rounded-[6px] bg-cranberry px-1.5 py-0.5 text-[11px] font-extrabold tracking-wide">LIVE</span>
      <span
        className="flex items-center gap-1 rounded-[6px] bg-black/40 px-1.5 py-0.5 text-[12px] font-semibold tabular-nums"
        aria-label={t("live.viewers", { count: viewers })}
      >
        <EyeIcon className="h-3.5 w-3.5" />
        {viewers}
      </span>
      <LanguageSwitcher compact />
      {account}
    </header>
  );
}
