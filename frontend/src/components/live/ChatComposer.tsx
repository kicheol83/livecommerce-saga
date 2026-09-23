"use client";

import { useState, type FormEvent } from "react";
import { CHAT_MAX_LENGTH } from "@/lib/config";

type ChatComposerProps = {
  connected: boolean;
  onSend: (text: string) => boolean;
};

export function ChatComposer({ connected, onSend }: ChatComposerProps) {
  const [text, setText] = useState("");

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
        채팅 입력
      </label>
      <input
        id="chat-input"
        value={text}
        onChange={(event) => setText(event.target.value)}
        maxLength={CHAT_MAX_LENGTH}
        disabled={!connected}
        autoComplete="off"
        placeholder={connected ? "채팅을 입력하세요" : "채팅에 연결하는 중이에요"}
        className="h-10 min-w-0 flex-1 rounded-full bg-black/40 px-4 text-[14px] text-white backdrop-blur-sm placeholder:text-white/60 disabled:opacity-60"
      />
      <button
        type="submit"
        disabled={!connected || text.trim() === ""}
        className="h-10 shrink-0 rounded-full bg-frost px-4 text-[14px] font-semibold text-pine transition-opacity disabled:opacity-40"
      >
        보내기
      </button>
    </form>
  );
}
