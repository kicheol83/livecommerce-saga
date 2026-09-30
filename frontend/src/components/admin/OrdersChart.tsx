import type { MinuteBucket } from "@/lib/adminTypes";
import { locale, t } from "@/i18n/core";

type OrdersChartProps = {
  buckets: MinuteBucket[];
  minutes?: number;
};

const WIDTH = 720;
const HEIGHT = 180;
const AXIS = 22;

export function OrdersChart({ buckets, minutes = 30 }: OrdersChartProps) {
  const byMinute = new Map(buckets.map((bucket) => [new Date(bucket.minute).getTime(), bucket]));
  const end = Math.floor(Date.now() / 60000) * 60000;
  const series = Array.from({ length: minutes }, (_, index) => {
    const time = end - (minutes - 1 - index) * 60000;
    const bucket = byMinute.get(time);
    return { time, created: bucket?.created ?? 0, completed: bucket?.completed ?? 0 };
  });
  const peak = Math.max(1, ...series.map((point) => point.created));
  const slot = WIDTH / minutes;
  const barWidth = Math.max(4, slot * 0.62);
  const plotHeight = HEIGHT - AXIS;
  const totalCreated = series.reduce((sum, point) => sum + point.created, 0);
  const totalCompleted = series.reduce((sum, point) => sum + point.completed, 0);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={t("admin.chart.aria", { minutes, created: totalCreated, completed: totalCompleted })}
      >
        {[0.5, 1].map((ratio) => (
          <line
            key={ratio}
            x1={0}
            x2={WIDTH}
            y1={plotHeight - plotHeight * ratio}
            y2={plotHeight - plotHeight * ratio}
            stroke="#D6E1E1"
            strokeDasharray="3 5"
          />
        ))}
        {series.map((point, index) => {
          const x = index * slot + (slot - barWidth) / 2;
          const createdHeight = (point.created / peak) * (plotHeight - 8);
          const completedHeight = (point.completed / peak) * (plotHeight - 8);
          const label = new Date(point.time).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false });
          return (
            <g key={point.time}>
              <title>{t("admin.chart.bar", { label, created: point.created, completed: point.completed })}</title>
              <rect x={x} y={plotHeight - createdHeight} width={barWidth} height={createdHeight} rx={2} fill="#D6E1E1" />
              <rect x={x} y={plotHeight - completedHeight} width={barWidth} height={completedHeight} rx={2} fill="#16302B" />
              {(index % 10 === 0 || index === minutes - 1) && (
                <text
                  x={index === 0 ? x : index === minutes - 1 ? x + barWidth : x + barWidth / 2}
                  y={HEIGHT - 4}
                  textAnchor={index === 0 ? "start" : index === minutes - 1 ? "end" : "middle"}
                  fontSize={11}
                  fill="#5B6B70"
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
        <text x={WIDTH} y={12} textAnchor="end" fontSize={11} fill="#5B6B70">
          {t("admin.chart.peak", { peak })}
        </text>
      </svg>
      <figcaption className="mt-2 flex gap-4 text-[12px] text-ash">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-frost-300" aria-hidden="true" />
          {t("admin.chart.created")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-pine" aria-hidden="true" />
          {t("admin.chart.completed")}
        </span>
      </figcaption>
    </figure>
  );
}
