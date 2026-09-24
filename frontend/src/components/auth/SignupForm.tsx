"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage, safeNextPath, validateSignup, type SignupFields } from "@/lib/authMessages";
import { signup } from "@/lib/authStore";
import { TextField } from "./TextField";

type FieldErrors = Partial<Record<keyof SignupFields, string>>;

const SERVER_FIELD_ERRORS: Record<string, keyof SignupFields> = {
  EMAIL_TAKEN: "email",
  NICKNAME_TAKEN: "nickname"
};

export function SignupForm() {
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get("next"));
  const auth = useAuth();
  const [fields, setFields] = useState<SignupFields>({ email: "", nickname: "", password: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof SignupFields, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (auth.status === "authenticated") {
      router.replace(next);
    }
  }, [auth.status, next, router]);

  const clientErrors = validateSignup(fields);
  const errorFor = (name: keyof SignupFields) => serverErrors[name] ?? (touched[name] ? clientErrors[name] : undefined);

  const update = (name: keyof SignupFields) => (value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
    setServerErrors((current) => ({ ...current, [name]: undefined }));
  };

  const markTouched = (name: keyof SignupFields) => () => {
    setTouched((current) => ({ ...current, [name]: true }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched({ email: true, nickname: true, password: true });
    if (Object.keys(clientErrors).length > 0) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    const result = await signup(fields.email.trim(), fields.password, fields.nickname.trim());
    setSubmitting(false);
    if (result.ok) {
      return;
    }
    const field = SERVER_FIELD_ERRORS[result.error.code];
    if (field !== undefined) {
      setServerErrors({ [field]: authErrorMessage(result.error.code) });
    } else {
      setFormError(authErrorMessage(result.error.code));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <TextField
        id="email"
        label="이메일"
        type="email"
        value={fields.email}
        autoComplete="email"
        error={errorFor("email")}
        onChange={update("email")}
        onBlur={markTouched("email")}
      />
      <TextField
        id="nickname"
        label="닉네임"
        type="text"
        value={fields.nickname}
        autoComplete="nickname"
        hint="라이브 채팅에 이 이름으로 표시돼요."
        error={errorFor("nickname")}
        onChange={update("nickname")}
        onBlur={markTouched("nickname")}
      />
      <TextField
        id="password"
        label="비밀번호"
        type="password"
        value={fields.password}
        autoComplete="new-password"
        hint="8자 이상 입력해 주세요."
        error={errorFor("password")}
        onChange={update("password")}
        onBlur={markTouched("password")}
      />
      {formError !== null && (
        <p role="alert" className="rounded-[12px] bg-cranberry/10 px-3.5 py-2.5 text-[14px] text-cranberry">
          {formError}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 h-[52px] rounded-[14px] bg-cranberry text-[16px] font-bold text-white transition-colors hover:bg-cranberry-700 disabled:bg-ash/50"
      >
        {submitting ? "가입하는 중" : "가입하기"}
      </button>
      <p className="text-center text-[14px] text-ash">
        이미 계정이 있나요?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-pine underline underline-offset-4">
          로그인
        </Link>
      </p>
    </form>
  );
}
