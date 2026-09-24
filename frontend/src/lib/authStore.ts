export type AuthRole = "USER" | "ADMIN";

export type AuthUser = {
  userId: string;
  email: string;
  nickname: string;
  role: AuthRole;
};

export type AuthState = {
  status: "loading" | "authenticated" | "anonymous";
  user: AuthUser | null;
};

export type AuthFailure = {
  code: string;
  fields: Record<string, string>;
};

export type AuthResult = { ok: true } | { ok: false; error: AuthFailure };

type TokenResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: AuthUser;
};

const LOADING_STATE: AuthState = { status: "loading", user: null };
const REFRESH_MARGIN_SECONDS = 60;
const MIN_REFRESH_DELAY_SECONDS = 10;

let state: AuthState = LOADING_STATE;
let accessToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let refreshInFlight: Promise<boolean> | null = null;
let started = false;
const listeners = new Set<() => void>();

function publish(next: AuthState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function cancelScheduledRefresh(): void {
  if (refreshTimer !== undefined) {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }
}

function scheduleRefresh(expiresIn: number): void {
  cancelScheduledRefresh();
  const delaySeconds = Math.max(MIN_REFRESH_DELAY_SECONDS, expiresIn - REFRESH_MARGIN_SECONDS);
  refreshTimer = setTimeout(() => {
    void refreshSession();
  }, delaySeconds * 1000);
}

function applySession(session: TokenResponse): void {
  accessToken = session.accessToken;
  scheduleRefresh(session.expiresIn);
  publish({ status: "authenticated", user: session.user });
}

function clearSession(): void {
  accessToken = null;
  cancelScheduledRefresh();
  publish({ status: "anonymous", user: null });
}

async function readFailure(response: Response): Promise<AuthFailure> {
  try {
    const body = (await response.json()) as { code?: string; fields?: Record<string, string> };
    return { code: body.code ?? "UNKNOWN", fields: body.fields ?? {} };
  } catch {
    return { code: response.status >= 500 ? "SERVER_ERROR" : "UNKNOWN", fields: {} };
  }
}

async function submitCredentials(path: string, body: Record<string, string>): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    if (!response.ok) {
      return { ok: false, error: await readFailure(response) };
    }
    applySession((await response.json()) as TokenResponse);
    return { ok: true };
  } catch {
    return { ok: false, error: { code: "NETWORK_ERROR", fields: {} } };
  }
}

export function subscribeAuth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getAuthState(): AuthState {
  return state;
}

export function getServerAuthState(): AuthState {
  return LOADING_STATE;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function startAuth(): void {
  if (started) {
    return;
  }
  started = true;
  void refreshSession();
}

export function refreshSession(): Promise<boolean> {
  if (refreshInFlight !== null) {
    return refreshInFlight;
  }
  refreshInFlight = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", { method: "POST", cache: "no-store" });
      if (!response.ok) {
        clearSession();
        return false;
      }
      applySession((await response.json()) as TokenResponse);
      return true;
    } catch {
      clearSession();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export function login(email: string, password: string): Promise<AuthResult> {
  return submitCredentials("/api/auth/login", { email, password });
}

export function signup(email: string, password: string, nickname: string): Promise<AuthResult> {
  return submitCredentials("/api/auth/signup", { email, password, nickname });
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST", cache: "no-store" }).catch(() => undefined);
  clearSession();
}

export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const send = () => {
    const headers = new Headers(init.headers);
    if (accessToken !== null) {
      headers.set("Authorization", `Bearer ${accessToken}`);
    }
    return fetch(input, { ...init, headers, cache: "no-store" });
  };
  const response = await send();
  if (response.status !== 401) {
    return response;
  }
  const refreshed = await refreshSession();
  return refreshed ? send() : response;
}
