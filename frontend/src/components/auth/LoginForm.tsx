"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage, safeNextPath } from "@/lib/authMessages";
import { login } from "@/lib/authStore";
import { TextField } from "./TextField";

export function LoginForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(next);
    }
  }, [auth.status, next, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (email.trim() === "" || password === "") {
      setError("이메일과 비밀번호를 입력해 주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const result = await login(email, password);
    setSubmitting(false);
    if (!result.ok) {
      setError(authErrorMessage(result.error.code));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <TextField id="email" label="이메일" type="email" value={email} autoComplete="email" onChange={setEmail} />
      <TextField
        id="password"
        label="비밀번호"
        type="password"
        value={password}
        autoComplete="current-password"
        onChange={setPassword}
      />
      {error !== null && (
        <p role="alert" className="rounded-[12px] bg-cranberry/10 px-3.5 py-2.5 text-[14px] text-cranberry">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 h-[52px] rounded-[14px] bg-cranberry text-[16px] font-bold text-white transition-colors hover:bg-cranberry-700 disabled:bg-ash/50"
      >
        {submitting ? "로그인하는 중" : "로그인"}
      </button>
      <p className="text-center text-[14px] text-ash">
        계정이 없나요?{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-pine underline underline-offset-4">
          회원가입
        </Link>
      </p>
    </form>
  );
}
