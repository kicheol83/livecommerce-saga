const MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않아요.",
  EMAIL_TAKEN: "이미 가입된 이메일이에요.",
  NICKNAME_TAKEN: "이미 사용 중인 닉네임이에요.",
  ACCOUNT_CONFLICT: "이미 사용 중인 이메일이나 닉네임이에요.",
  VALIDATION_FAILED: "입력한 내용을 다시 확인해 주세요.",
  NETWORK_ERROR: "서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요."
};

export function authErrorMessage(code: string): string {
  return MESSAGES[code] ?? "요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.";
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
    errors.email = "이메일 형식을 확인해 주세요.";
  }
  if (!NICKNAME_PATTERN.test(fields.nickname.trim())) {
    errors.nickname = "닉네임은 2~20자의 한글, 영문, 숫자, _만 쓸 수 있어요.";
  }
  if (fields.password.length < 8 || fields.password.length > 72) {
    errors.password = "비밀번호는 8자 이상 72자 이하로 입력해 주세요.";
  }
  return errors;
}
