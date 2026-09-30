import type { OutboxHealth } from "@/lib/adminTypes";
import { EVENT_LABEL } from "@/lib/adminFormat";
import { formatDuration, formatRelative } from "@/lib/format";
import { Panel, Pill } from "./AdminParts";
import { t } from "@/i18n/core";

const LAG_WARNING_SECONDS = 10;

export function OutboxHealthCard({ title, health }: { title: string; health: OutboxHealth | null }) {
  if (health === null) {
    return (
      <Panel title={title}>
        <div className="h-24 animate-pulse rounded-[12px] bg-frost motion-reduce:animate-none" />
      </Panel>
    );
  }

  const lagging = (health.oldestPendingAgeSeconds ?? 0) > LAG_WARNING_SECONDS;
  const status =
    health.pendingWithErrors > 0 ? (
      <Pill tone="danger">{t("admin.outbox.failing")}</Pill>
    ) : lagging ? (
      <Pill tone="progress">{t("admin.outbox.delayed")}</Pill>
    ) : (
      <Pill tone="done">{t("admin.outbox.healthy")}</Pill>
    );

  return (
    <Panel title={title} action={status}>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-[12px] bg-frost px-2 py-3">
          <dt className="text-[12px] text-ash">{t("admin.outbox.pending")}</dt>
          <dd className="mt-1 text-[20px] font-bold tabular-nums">{health.pending}</dd>
        </div>
        <div className="rounded-[12px] bg-frost px-2 py-3">
          <dt className="text-[12px] text-ash">{t("admin.outbox.oldest")}</dt>
          <dd className="mt-1 text-[20px] font-bold tabular-nums">
            {health.oldestPendingAgeSeconds === null ? t("common.none") : formatDuration(health.oldestPendingAgeSeconds)}
          </dd>
        </div>
        <div className="rounded-[12px] bg-frost px-2 py-3">
          <dt className="text-[12px] text-ash">{t("admin.outbox.lastHour")}</dt>
          <dd className="mt-1 text-[20px] font-bold tabular-nums">{health.publishedLastHour}</dd>
        </div>
      </dl>
      {health.recentErrors.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[13px] font-semibold text-ash">{t("admin.outbox.errors")}</h3>
          <ul className="mt-2 divide-y divide-frost-300 text-[13px]">
            {health.recentErrors.slice(0, 4).map((event) => (
              <li key={event.id} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{EVENT_LABEL[event.eventType] ?? event.eventType}</span>
                  <span className="text-ash tabular-nums">
                    {t("admin.outbox.attempts", { count: event.attempts, time: formatRelative(event.createdAt) })}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-ash" title={event.lastError ?? ""}>
                  {event.lastError}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
