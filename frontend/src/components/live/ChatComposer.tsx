"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CHAT_MAX_LENGTH } from "@/lib/config";
import { t } from "@/i18n/core";

type ChatComposerProps = {
  mode: "ready" | "connecting" | "guest";
  onSend: (text: string) => boolean;
};

export function ChatComposer({ mode, onSend }: ChatComposerProps) {
  const [text, setText] = useState("");

  if (mode === "guest") {
    return (
      <Link
        href="/login?next=/"
        className="mt-2 flex h-10 items-center rounded-full bg-black/40 px-4 text-[14px] text-white/85 backdrop-blur-sm hover:bg-black/50"
      >
        {t("live.chat.loginPrompt")}
      </Link>
    );
  }

  const connected = mode === "ready";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (trimmed === "") {
      return;
    }
    if (onSend(trimmed)) {
      setText("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
      <label htmlFor="chat-input" className="sr-only">
        {t("live.chat.inputLabel")}
      </label>
      <input
        id="chat-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={CHAT_MAX_LENGTH}
        disabled={!connected}
        autoComplete="off"
        placeholder={connected ? t("live.chat.placeholder") : t("live.chat.connecting")}
        className="h-10 min-w-0 flex-1 rounded-full bg-black/40 px-4 text-[14px] text-white backdrop-blur-sm placeholder:text-white/60 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!connected || text.trim() === ""}
        className="h-10 shrink-0 rounded-full bg-frost px-4 text-[14px] font-semibold text-pine transition-opacity disabled:opacity-40"
      >
        {t("live.chat.send")}
      </button>
    </form>
  );
}
