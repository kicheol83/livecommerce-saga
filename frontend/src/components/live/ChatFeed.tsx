import { CHAT_VISIBLE_COUNT } from "@/lib/config";
import type { ChatMessage } from "@/lib/types";
import { t } from "@/i18n/core";

type ChatFeedProps = {
  messages: ChatMessage[];
  nickname: string | null;
};

export function ChatFeed({ messages, nickname }: ChatFeedProps) {
  const visible = messages.slice(-CHAT_VISIBLE_COUNT);

  if (visible.length === 0) {
    return <p className="text-[13px] text-white/70">{t("live.chat.empty")}</p>;
  }

  return (
    <ol role="log" aria-label={t("live.chat.log")} className="chat-fade flex max-h-44 flex-col items-start justify-end gap-1.5 overflow-hidden pt-6">
      {visible.map((message) => {
        const mine = message.author === nickname;
        return (
          <li
            key={message.id}
            className={`max-w-[85%] shrink-0 rounded-[12px] px-2.5 py-1.5 text-[13.5px] leading-snug text-white backdrop-blur-sm [overflow-wrap:anywhere] ${
              mine ? "bg-cranberry/80" : "bg-black/40"
            }`}
          >
            <span className="mr-1.5 font-semibold text-white/75">{message.author}</span>
            {message.text}
          </li>
        );
      })}
    </ol>
  );
}
