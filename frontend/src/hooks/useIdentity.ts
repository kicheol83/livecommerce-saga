"use client";

import { useEffect, useState } from "react";

export type Identity = {
  memberId: string;
  nickname: string;
};

const STORAGE_KEY = "livecommerce.identity";

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function readStored(): Identity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (typeof parsed.memberId === "string" && typeof parsed.nickname === "string") {
      return { memberId: parsed.memberId, nickname: parsed.nickname };
    }
    return null;
  } catch {
    return null;
  }
}

function store(identity: Identity): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
  } catch {
    return;
  }
}

export function useIdentity(): Identity | null {
  const [identity, setIdentity] = useState<Identity | null>(null);

  useEffect(() => {
    const existing = readStored();
    if (existing !== null) {
      setIdentity(existing);
      return;
    }
    const created: Identity = {
      memberId: randomId(),
      nickname: `시청자${Math.floor(1000 + Math.random() * 9000)}`
    };
    store(created);
    setIdentity(created);
  }, []);

  return identity;
}
