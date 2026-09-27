import type { AdminOrder, OutboxEvent } from "@/lib/adminTypes";
import { EVENT_LABEL, ORDER_STATUS_LABEL } from "@/lib/adminFormat";
import { formatDuration } from "@/lib/format";

type Lane = "주문" | "결제" | "재고";

type TimelineEntry = {
  key: string;
  lane: Lane;
  time: number;
  label: string;
  delivery: "system" | "published" | "pending" | "failing";
  detail: string | null;
};

const LANES: Lane[] = ["주문", "결제", "재고"];
const WIDTH = 520;
const LANE_HEIGHT = 34;
const LABEL_WIDTH = 44;
const PADDING = 14;

const DOT_FILL: Record<TimelineEntry["delivery"], string> = {
  system: "#16302B",
  published: "#16302B",
  pending: "#E0A526",
  failing: "#C8203F"
};

function deliveryOf(event: OutboxEvent): TimelineEntry["delivery"] {
  if (event.status === "PUBLISHED") {
    return "published";
  }
  return event.attempts > 0 ? "failing" : "pending";
}

function buildEntries(order: AdminOrder, paymentEvents: OutboxEvent[], inventoryEvents: OutboxEvent[]): TimelineEntry[] {
  const toEntry = (lane: Lane) => (event: OutboxEvent): TimelineEntry => ({
    key: event.id,
    lane,
    time: new Date(event.createdAt).getTime(),
    label: EVENT_LABEL[event.eventType] ?? event.eventType,
    delivery: deliveryOf(event),
    detail: event.lastError
  });
  const entries: TimelineEntry[] = [
    {
      key: "created",
      lane: "주문",
      time: new Date(order.createdAt).getTime(),
      label: "주문 생성",
      delivery: "system",
      detail: null
    },
    ...inventoryEvents.map(toEntry("재고")),
    ...paymentEvents.map(toEntry("결제")),
    {
      key: "current",
      lane: "주문",
      time: new Date(order.updatedAt).getTime(),
      label: `현재 상태: ${ORDER_STATUS_LABEL[order.status]}`,
      delivery: "system",
      detail: null
    }
  ];
  return entries.sort((left, right) => left.time - right.time);
}

export function SagaTimeline({
  order,
  paymentEvents,
  inventoryEvents
}: {
  order: AdminOrder;
  paymentEvents: OutboxEvent[];
  inventoryEvents: OutboxEvent[];
}) {
  const entries = buildEntries(order, paymentEvents, inventoryEvents);
  const start = entries[0].time;
  const end = Math.max(start + 1000, ...entries.map((entry) => entry.time));
  const span = end - start;
  const plotWidth = WIDTH - LABEL_WIDTH - PADDING * 2;
  const height = LANES.length * LANE_HEIGHT + 18;
  const xOf = (time: number) => LABEL_WIDTH + PADDING + ((time - start) / span) * plotWidth;

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Saga 진행 ${formatDuration(span / 1000)} 동안 이벤트 ${entries.length}개`}
      >
        {LANES.map((lane, index) => {
          const y = index * LANE_HEIGHT + LANE_HEIGHT / 2;
          return (
            <g key={lane}>
              <text x={0} y={y + 4} fontSize={12} fontWeight={600} fill="#5B6B70">
                {lane}
              </text>
              <line x1={LABEL_WIDTH} x2={WIDTH} y1={y} y2={y} stroke="#D6E1E1" strokeWidth={2} strokeLinecap="round" />
            </g>
          );
        })}
        {entries.map((entry, index) => {
          const y = LANES.indexOf(entry.lane) * LANE_HEIGHT + LANE_HEIGHT / 2;
          const x = xOf(entry.time);
          return (
            <g key={entry.key}>
              <title>{`${index + 1}. ${entry.label} (+${formatDuration((entry.time - start) / 1000)})`}</title>
              <circle cx={x} cy={y} r={10} fill={DOT_FILL[entry.delivery]} stroke="#FFFFFF" strokeWidth={2} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={10} fontWeight={700} fill="#FFFFFF">
                {index + 1}
              </text>
            </g>
          );
        })}
        <text x={LABEL_WIDTH + PADDING} y={height - 2} fontSize={11} fill="#5B6B70">
          0초
        </text>
        <text x={WIDTH - PADDING} y={height - 2} textAnchor="end" fontSize={11} fill="#5B6B70">
          +{formatDuration(span / 1000)}
        </text>
      </svg>

      <ol className="mt-3 space-y-2">
        {entries.map((entry, index) => (
          <li key={entry.key} className="flex gap-3 text-[13px]">
            <span
              className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: DOT_FILL[entry.delivery] }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-semibold">
                  {entry.label}
                  <span className="ml-2 font-normal text-ash">{entry.lane}</span>
                </span>
                <span className="text-ash tabular-nums">+{formatDuration((entry.time - start) / 1000)}</span>
              </div>
              {entry.delivery === "pending" && <p className="text-[#7A5510]">Kafka 전달 대기 중</p>}
              {entry.delivery === "failing" && (
                <p className="break-all text-cranberry">전달 재시도 중: {entry.detail ?? "원인 미상"}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
