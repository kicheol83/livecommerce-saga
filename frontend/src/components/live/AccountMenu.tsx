"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { AuthState } from "@/lib/authStore";

type AccountMenuProps = {
  auth: AuthState;
  onLogout: () => void;
};

export function AccountMenu({ auth, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointer = (event: PointerEvent) => {
      if (containerRef.current !== null && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("pointerdown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (auth.status === "loading") {
    return <span className="h-7 w-7 shrink-0" aria-hidden="true" />;
  }

  if (auth.status === "anonymous" || auth.user === null) {
    return (
      <Link
        href="/login?next=/"
        className="shrink-0 rounded-[6px] bg-white/20 px-2 py-0.5 text-[12px] font-semibold text-white backdrop-blur-sm hover:bg-white/30"
      >
        로그인
      </Link>
    );
  }

  const user = auth.user;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${user.nickname} 계정 메뉴`}
        className="grid h-7 w-7 place-items-center rounded-full bg-frost text-[12px] font-bold text-pine"
      >
        {user.nickname.slice(0, 1)}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-30 w-56 animate-fade_in rounded-[14px] bg-frost p-1.5 text-pine shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
        >
          <div className="px-3 pb-2 pt-2.5">
            <p className="text-[15px] font-semibold">{user.nickname}</p>
            <p className="truncate text-[13px] text-ash">{user.email}</p>
          </div>
          {user.role === "ADMIN" && (
            <Link
              href="/admin"
              role="menuitem"
              className="flex h-10 w-full items-center rounded-[10px] px-3 text-left text-[14px] font-medium hover:bg-frost-300"
            >
              운영 콘솔
            </Link>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="h-10 w-full rounded-[10px] px-3 text-left text-[14px] font-medium hover:bg-frost-300"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  );
}
