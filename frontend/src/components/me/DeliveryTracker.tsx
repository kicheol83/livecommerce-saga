"use client";

import { useEffect, useState } from "react";
import { fetchDelivery } from "@/lib/api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { DELIVERY_HEADLINE, DELIVERY_STEPS, deliveryStepIndex } from "@/lib/shipping";
import type { Delivery } from "@/lib/types";
import { t } from "@/i18n/core";

const REFRESH_MS = 6000;

export function DeliveryTracker({ orderId }: { orderId: string }) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const delivered = delivery?.status === "DELIVERED";

  useEffect(() => {
    if (delivered) {
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchDelivery(orderId)
        .then((result) => {
          if (!cancelled) {
            setDelivery(result);
            setLoaded(true);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLoaded(true);
          }
        });
    };
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        load();
      }
    }, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [orderId, delivered]);

  const current = deliveryStepIndex(delivery?.status ?? null);
  const latest = delivery === null || delivery.events.length === 0 ? null : delivery.events[delivery.events.length - 1];

  return (
    <div className="mt-4 border-t border-frost-300 pt-4">
      <p className="text-[16px] font-bold">
        {delivery === null ? (loaded ? t("delivery.preparingInfo") : t("delivery.loadingInfo")) : DELIVERY_HEADLINE[delivery.status]}
      </p>
      {latest !== null && (
        <p className="mt-0.5 text-[13px] text-ash">
          {latest.location}, {latest.description} <span className="tabular-nums">({formatRelative(latest.occurredAt)})</span>
        </p>
      )}

      <ol className="mt-4 grid grid-cols-5" aria-label={t("delivery.stepsLabel")}>
        {DELIVERY_STEPS.map((label, index) => {
          const done = index < current || (index === current && delivered);
          const active = index === current && !delivered;
          return (
            <li key={label} className="relative flex flex-col items-center text-center">
              {index > 0 && (
                <span
                  className={`absolute right-1/2 top-[7px] h-0.5 w-full ${index <= current ? "bg-pine" : "bg-frost-300"}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`relative z-10 h-4 w-4 rounded-full border-2 ${
                  active ? "border-cranberry bg-white" : done ? "border-pine bg-pine" : "border-frost-300 bg-white"
                }`}
                aria-hidden="true"
              />
              <span className={`mt-1.5 text-[11px] leading-tight ${active ? "font-bold text-cranberry" : done ? "font-semibold text-pine" : "text-ash"}`}>
                {label}
              </span>
              <span className="sr-only">{done ? t("delivery.state.done") : active ? t("delivery.state.active") : t("delivery.state.pending")}</span>
            </li>
          );
        })}
      </ol>

      {delivery !== null && (
        <div className="mt-4">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-ash">
              {delivery.carrier} <span className="font-semibold tabular-nums text-pine">{delivery.trackingNumber}</span>
            </span>
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
              className="font-semibold text-pine underline underline-offset-4"
            >
              {expanded ? t("delivery.trackClose") : t("delivery.trackOpen")}
            </button>
          </div>
          {expanded && (
            <ol className="mt-3 space-y-3 border-l-2 border-frost-300 pl-4">
              {[...delivery.events].reverse().map((event, index) => (
                <li key={event.eventId} className="relative text-[13px]">
                  <span
                    className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-cranberry" : "bg-frost-300"}`}
                    aria-hidden="true"
                  />
                  <p className={index === 0 ? "font-bold text-pine" : "font-medium text-pine"}>{event.description}</p>
                  <p className="text-ash tabular-nums">
                    {formatDateTime(event.occurredAt)}, {event.location}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
