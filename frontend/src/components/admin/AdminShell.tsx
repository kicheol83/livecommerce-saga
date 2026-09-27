"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { logout } from "@/lib/authStore";

const NAV_ITEMS = [
  { href: "/admin", label: "대시보드" },
  { href: "/admin/orders", label: "주문" },
  { href: "/admin/inventory", label: "재고" }
];

export function AdminShell({ children }: { children: ReactNode }) {
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
          <h1 className="text-[22px] font-bold">관리자만 볼 수 있는 페이지예요</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ash">
            {auth.user.nickname} 계정에는 관리자 권한이 없어요. 관리자 계정으로 다시 로그인해 주세요.
          </p>
          <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-pine px-6 text-[15px] font-semibold text-frost">
            라이브로 돌아가기
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
            <span className="block text-[12px] font-medium text-frost/60">겨울 니트 라이브</span>
            <span className="block text-[17px] font-bold">운영 콘솔</span>
          </Link>
          <nav aria-label="관리자 메뉴" className="flex gap-1 overflow-x-auto lg:mt-8 lg:flex-col">
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
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="hidden px-5 lg:absolute lg:bottom-6 lg:block">
          <p className="text-[13px] font-semibold">{user.nickname}</p>
          <p className="truncate text-[12px] text-frost/60">{user.email}</p>
          <div className="mt-3 flex gap-3 text-[13px]">
            <Link href="/" className="text-frost/75 underline-offset-4 hover:underline">
              라이브 보기
            </Link>
            <button
              type="button"
              onClick={() => {
                void logout().then(() => router.replace("/"));
              }}
              className="text-frost/75 underline-offset-4 hover:underline"
            >
              로그아웃
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
