import type { OutboxHealth } from "@/lib/adminTypes";
import { EVENT_LABEL } from "@/lib/adminFormat";
import { formatDuration, formatRelative } from "@/lib/format";
import { Panel, Pill } from "./AdminParts";

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
      <Pill tone="danger">전달 실패 중</Pill>
    ) : lagging ? (
      <Pill tone="progress">지연</Pill>
    ) : (
      <Pill tone="done">정상</Pill>
    );

  return (
    <Panel title={title} action={status}>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-[12px] bg-frost px-2 py-3">
          <dt className="text-[12px] text-ash">대기 중</dt>
          <dd className="mt-1 text-[20px] font-bold tabular-nums">{health.pending}</dd>
        </div>
        <div className="rounded-[12px] bg-frost px-2 py-3">
          <dt className="text-[12px] text-ash">가장 오래된 대기</dt>
          <dd className="mt-1 text-[20px] font-bold tabular-nums">
            {health.oldestPendingAgeSeconds === null ? "없음" : formatDuration(health.oldestPendingAgeSeconds)}
          </dd>
        </div>
        <div className="rounded-[12px] bg-frost px-2 py-3">
          <dt className="text-[12px] text-ash">최근 1시간 전달</dt>
          <dd className="mt-1 text-[20px] font-bold tabular-nums">{health.publishedLastHour}</dd>
        </div>
      </dl>
      {health.recentErrors.length > 0 && (
        <div className="mt-4">
          <h3 className="text-[13px] font-semibold text-ash">최근 전달 오류</h3>
          <ul className="mt-2 divide-y divide-frost-300 text-[13px]">
            {health.recentErrors.slice(0, 4).map((event) => (
              <li key={event.id} className="py-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{EVENT_LABEL[event.eventType] ?? event.eventType}</span>
                  <span className="text-ash tabular-nums">
                    {event.attempts}회 시도, {formatRelative(event.createdAt)}
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
