import type { AdminOrder, OutboxEvent } from "@/lib/adminTypes";
import { EVENT_LABEL, ORDER_STATUS_LABEL } from "@/lib/adminFormat";
import { formatDuration } from "@/lib/format";
import { t } from "@/i18n/core";

type Lane = "order" | "payment" | "inventory";

type TimelineEntry = {
  key: string;
  lane: Lane;
  time: number;
  label: string;
  delivery: "system" | "published" | "pending" | "failing";
  detail: string | null;
};

const LANES: Lane[] = ["order", "payment", "inventory"];
const WIDTH = 520;
const LANE_HEIGHT = 34;
const LABEL_WIDTH = 64;
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
      lane: "order",
      time: new Date(order.createdAt).getTime(),
      label: t("admin.timeline.created"),
      delivery: "system",
      detail: null
    },
    ...inventoryEvents.map(toEntry("inventory")),
    ...paymentEvents.map(toEntry("payment")),
    {
      key: "current",
      lane: "order",
      time: new Date(order.updatedAt).getTime(),
      label: t("admin.timeline.current", { status: ORDER_STATUS_LABEL[order.status] }),
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
        aria-label={t("admin.timeline.aria", { duration: formatDuration(span / 1000), count: entries.length })}
      >
        {LANES.map((lane, index) => {
          const y = index * LANE_HEIGHT + LANE_HEIGHT / 2;
          return (
            <g key={lane}>
              <text x={0} y={y + 4} fontSize={12} fontWeight={600} fill="#5B6B70">
                {t(`admin.lane.${lane}`)}
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
          {t("admin.timeline.zero")}
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
                  <span className="ml-2 font-normal text-ash">{t(`admin.lane.${entry.lane}`)}</span>
                </span>
                <span className="text-ash tabular-nums">+{formatDuration((entry.time - start) / 1000)}</span>
              </div>
              {entry.delivery === "pending" && <p className="text-[#7A5510]">{t("admin.timeline.pending")}</p>}
              {entry.delivery === "failing" && (
                <p className="break-all text-cranberry">{t("admin.timeline.retrying", { detail: entry.detail ?? t("admin.timeline.unknown") })}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
