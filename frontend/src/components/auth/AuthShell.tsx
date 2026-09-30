"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";

type AuthShellProps = {
  title?: string;
  description?: string;
  titleKey?: string;
  descriptionKey?: string;
  children: ReactNode;
};

export function AuthShell({ title, description, titleKey, descriptionKey, children }: AuthShellProps) {
  useI18n();
  const heading = titleKey !== undefined ? t(titleKey) : title;
  const body = descriptionKey !== undefined ? t(descriptionKey) : description;
  return (
    <main className="knit-page flex min-h-[100dvh] justify-center md:items-center md:py-6">
      <div className="flex min-h-[100dvh] w-full max-w-[440px] flex-col bg-pine md:min-h-0 md:overflow-hidden md:rounded-[28px] md:shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
        <div className="px-5 pb-8 pt-[calc(16px+env(safe-area-inset-top))] text-frost">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="inline-flex h-9 items-center rounded-full text-[14px] font-medium text-frost/80 hover:text-frost">
              {t("common.backToLiveArrow")}
            </Link>
            <LanguageSwitcher />
          </div>
          <h1 className="mt-8 text-[26px] font-bold leading-tight">{heading}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-frost/75">{body}</p>
        </div>
        <section className="flex-1 rounded-t-[22px] bg-frost px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 text-pine md:flex-none">
          {children}
        </section>
      </div>
    </main>
  );
}
