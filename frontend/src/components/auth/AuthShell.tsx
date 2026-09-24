import Link from "next/link";
import type { ReactNode } from "react";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
};

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main className="knit-page flex min-h-[100dvh] justify-center md:items-center md:py-6">
      <div className="flex min-h-[100dvh] w-full max-w-[440px] flex-col bg-pine md:min-h-0 md:overflow-hidden md:rounded-[28px] md:shadow-[0_28px_70px_rgba(0,0,0,0.5)]">
        <div className="px-5 pb-8 pt-[calc(16px+env(safe-area-inset-top))] text-frost">
          <Link href="/" className="inline-flex h-9 items-center rounded-full text-[14px] font-medium text-frost/80 hover:text-frost">
            ← 라이브로 돌아가기
          </Link>
          <h1 className="mt-8 text-[26px] font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-frost/75">{description}</p>
        </div>
        <section className="flex-1 rounded-t-[22px] bg-frost px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6 text-pine md:flex-none">
          {children}
        </section>
      </div>
    </main>
  );
}
