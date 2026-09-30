"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage, safeNextPath, validateSignup, type SignupFields } from "@/lib/authMessages";
import { signup } from "@/lib/authStore";
import { TextField } from "./TextField";
import { t } from "@/i18n/core";
import { useI18n } from "@/i18n/I18nProvider";

type FieldErrors = Partial<Record<keyof SignupFields, string>>;

const SERVER_FIELD_ERRORS: Record<string, keyof SignupFields> = {
  EMAIL_TAKEN: "email",
  NICKNAME_TAKEN: "nickname"
};

export function SignupForm() {
  useI18n();
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
        label={t("auth.field.email")}
        type="email"
        value={fields.email}
        autoComplete="email"
        error={errorFor("email")}
        onChange={update("email")}
        onBlur={markTouched("email")}
      />
      <TextField
        id="nickname"
        label={t("auth.field.nickname")}
        type="text"
        value={fields.nickname}
        autoComplete="nickname"
        hint={t("auth.hint.nickname")}
        error={errorFor("nickname")}
        onChange={update("nickname")}
        onBlur={markTouched("nickname")}
      />
      <TextField
        id="password"
        label={t("auth.field.password")}
        type="password"
        value={fields.password}
        autoComplete="new-password"
        hint={t("auth.hint.password")}
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
        {submitting ? t("auth.signup.submitting") : t("auth.signup.submit")}
      </button>
      <p className="text-center text-[14px] text-ash">
        {t("auth.signup.haveAccount")}{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-pine underline underline-offset-4">
          {t("common.login")}
        </Link>
      </p>
    </form>
  );
}
