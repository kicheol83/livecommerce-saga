"use client";

import { useEffect, useRef } from "react";
import { ShippingAddressForm } from "@/components/shipping/ShippingAddressForm";
import type { AuthUser } from "@/lib/authStore";
import { t } from "@/i18n/core";

type AddressSheetProps = {
  onSaved: (user: AuthUser) => void;
  onClose: () => void;
};

export function AddressSheet({ onSaved, onClose }: AddressSheetProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 animate-fade_in bg-black/50" onClick={onClose} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="address-sheet-title"
        className="relative max-h-[92%] animate-sheet_in overflow-y-auto rounded-t-[22px] bg-frost px-5 pb-[calc(20px+env(safe-area-inset-bottom))] pt-5 text-pine motion-reduce:animate-none"
      >
        <h2 id="address-sheet-title" ref={headingRef} tabIndex={-1} className="text-[19px] font-bold outline-none">
          {t("address.sheetTitle")}
        </h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ash">
          {t("address.sheetBody")}
        </p>
        <div className="mt-5">
          <ShippingAddressForm initial={null} submitLabel={t("address.saveAndOrder")} onSaved={onSaved} onCancel={onClose} />
        </div>
      </section>
    </div>
  );
}
