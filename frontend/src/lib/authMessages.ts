import { t, translatedRecord } from "@/i18n/core";

const MESSAGES: Record<string, string> = translatedRecord({
  INVALID_CREDENTIALS: "auth.error.INVALID_CREDENTIALS",
  EMAIL_TAKEN: "auth.error.EMAIL_TAKEN",
  NICKNAME_TAKEN: "auth.error.NICKNAME_TAKEN",
  ACCOUNT_CONFLICT: "auth.error.ACCOUNT_CONFLICT",
  VALIDATION_FAILED: "auth.error.VALIDATION_FAILED",
  NETWORK_ERROR: "common.networkError"
});

export function authErrorMessage(code: string): string {
  return MESSAGES[code] ?? t("common.requestFailed");
}

export function safeNextPath(value: string | null): string {
  if (value === null || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}

export type SignupFields = {
  email: string;
  nickname: string;
  password: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NICKNAME_PATTERN = /^[\p{L}\p{N}_]{2,20}$/u;

export function validateSignup(fields: SignupFields): Partial<Record<keyof SignupFields, string>> {
  const errors: Partial<Record<keyof SignupFields, string>> = {};
  if (!EMAIL_PATTERN.test(fields.email.trim())) {
    errors.email = t("auth.validation.email");
  }
  if (!NICKNAME_PATTERN.test(fields.nickname.trim())) {
    errors.nickname = t("auth.validation.nickname");
  }
  if (fields.password.length < 8 || fields.password.length > 72) {
    errors.password = t("auth.validation.password");
  }
  return errors;
}
