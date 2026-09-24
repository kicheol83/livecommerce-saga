"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getAuthState, getServerAuthState, startAuth, subscribeAuth, type AuthState } from "@/lib/authStore";

export function useAuth(): AuthState {
  const state = useSyncExternalStore(subscribeAuth, getAuthState, getServerAuthState);

  useEffect(() => {
    startAuth();
  }, []);

  return state;
}
