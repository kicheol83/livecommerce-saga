"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/authStore";
import { t } from "@/i18n/core";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { useI18n } from "@/i18n/I18nProvider";

const NAV_ITEMS = [
  { href: "/admin", labelKey: "admin.nav.dashboard" },
  { href: "/admin/orders", labelKey: "admin.nav.orders" },
  { href: "/admin/inventory", labelKey: "admin.nav.inventory" }
];

export function AdminShell({ children }: { children: ReactNode }) {
  useI18n();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (auth.status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [auth.status, pathname, router]);

  if (auth.status !== "authenticated" || auth.user === null) {
    return <div className="min-h-[100dvh] bg-frost" aria-busy="true" />;
  }

  if (auth.user.role !== "ADMIN") {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-frost px-6 text-pine">
        <div className="max-w-sm text-center">
          <h1 className="text-[22px] font-bold">{t("admin.denied.title")}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ash">
            {t("admin.denied.body", { nickname: auth.user.nickname })}
          </p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-pine px-6 text-[15px] font-semibold text-frost">
            {t("common.backToLive")}
          </Link>
        </div>
      </main>
    );
  }

  const user = auth.user;

  return (
    <div className="min-h-[100dvh] bg-frost text-pine lg:grid lg:grid-cols-[232px_1fr]">
      <aside className="bg-pine text-frost lg:sticky lg:top-0 lg:h-[100dvh]">
        <div className="flex items-center justify-between gap-4 px-5 py-4 lg:block lg:py-6">
          <Link href="/admin" className="block">
            <span className="block text-[12px] font-medium text-frost/60">{t("admin.brand")}</span>
            <span className="block text-[17px] font-bold">{t("common.adminConsole")}</span>
          </Link>
          <nav aria-label={t("admin.menu")} className="flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col">
            {NAV_ITEMS.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 rounded-[10px] px-3 py-2 text-[14px] font-medium transition-colors ${
                    active ? "bg-frost text-pine" : "text-frost/75 hover:bg-white/10 hover:text-frost"
                  }`}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </nav>
          <div className="shrink-0 lg:mt-6">
            <LanguageSwitcher />
          </div>
        </div>
        <div className="hidden px-5 lg:absolute lg:bottom-6 lg:block">
          <p className="text-[13px] font-semibold">{user.nickname}</p>
          <p className="truncate text-[12px] text-frost/60">{user.email}</p>
          <div className="mt-3 flex gap-3 text-[13px]">
            <Link href="/" className="text-frost/75 underline-offset-4 hover:underline">
              {t("admin.viewLive")}
            </Link>
            <button
              type="button"
              onClick={() => {
                void logout().then(() => router.replace("/"));
              }}
              className="text-frost/75 underline-offset-4 hover:underline"
            >
              {t("common.logout")}
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 px-5 py-6 lg:px-8 lg:py-8">
        <div className="mx-auto max-w-[1240px]">{children}</div>
      </main>
    </div>
  );
}
