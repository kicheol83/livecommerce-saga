"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage, safeNextPath } from "@/lib/authMessages";
import { login } from "@/lib/authStore";
import { TextField } from "./TextField";
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";

export function LoginForm() {
  useI18n();
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
      setError(t("auth.login.empty"));
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
      <TextField id="email" label={t("auth.field.email")} type="email" value={email} autoComplete="email" onChange={setEmail} />
      <TextField
        id="password"
        label={t("auth.field.password")}
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
        {submitting ? t("auth.login.submitting") : t("common.login")}
      </button>
      <p className="text-center text-[14px] text-ash">
        {t("auth.login.noAccount")}{" "}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-pine underline underline-offset-4">
          {t("common.signup")}
        </Link>
      </p>
    </form>
  );
}
