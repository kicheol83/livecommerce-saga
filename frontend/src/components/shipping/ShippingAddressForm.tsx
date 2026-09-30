"use client";

import { useState, type FormEvent } from "react";
import { TextField } from "@/components/auth/TextField";
import { saveShippingAddress } from "@/lib/api";
import type { AuthUser } from "@/lib/authStore";
import { searchPostcode } from "@/lib/postcode";
import { emptyAddress, FIELD_MESSAGES, normalizeAddress, validateAddress, type AddressErrors } from "@/lib/shipping";
import type { ShippingAddress } from "@/lib/types";
import { t } from "@/i18n/core";

type ShippingAddressFormProps = {
  initial: ShippingAddress | null;
  submitLabel: string;
  onSaved: (user: AuthUser) => void;
  onCancel?: () => void;
};

type EditableAddress = Omit<ShippingAddress, "address2"> & { address2: string };

function toEditable(address: ShippingAddress | null): EditableAddress {
  const source = address ?? emptyAddress();
  return { ...source, address2: source.address2 ?? "" };
}

export function ShippingAddressForm({ initial, submitLabel, onSaved, onCancel }: ShippingAddressFormProps) {
  const [fields, setFields] = useState<EditableAddress>(() => toEditable(initial));
  const [submitted, setSubmitted] = useState(false);
  const [serverErrors, setServerErrors] = useState<AddressErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const clientErrors = validateAddress(fields);
  const errorFor = (name: keyof ShippingAddress) => serverErrors[name] ?? (submitted ? clientErrors[name] : undefined);

  const update = (name: keyof EditableAddress) => (value: string) => {
    setFields((current) => ({ ...current, [name]: value }));
    setServerErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSearch = async () => {
    setSearchError(null);
    try {
      const result = await searchPostcode();
      if (result !== null) {
        setFields((current) => ({ ...current, zipCode: result.zipCode, address1: result.address }));
        setServerErrors((current) => ({ ...current, zipCode: undefined, address1: undefined }));
      }
    } catch {
      setSearchError(t("address.searchFailed"));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (Object.keys(clientErrors).length > 0) {
      return;
    }
    setSaving(true);
    setFormError(null);
    const result = await saveShippingAddress(normalizeAddress(fields));
    setSaving(false);
    if (result.ok) {
      onSaved(result.user);
      return;
    }
    const mapped: AddressErrors = {};
    Object.keys(result.fields).forEach((name) => {
      if (name in FIELD_MESSAGES) {
        mapped[name as keyof ShippingAddress] = FIELD_MESSAGES[name as keyof ShippingAddress];
      }
    });
    setServerErrors(mapped);
    if (Object.keys(mapped).length === 0) {
      setFormError(t("address.saveFailed"));
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <TextField
        id="recipientName"
        label={t("address.recipient")}
        type="text"
        value={fields.recipientName}
        autoComplete="shipping name"
        error={errorFor("recipientName")}
        onChange={update("recipientName")}
      />
      <TextField
        id="phone"
        label={t("address.phone")}
        type="tel"
        inputMode="tel"
        placeholder="010-1234-5678"
        value={fields.phone}
        autoComplete="shipping tel"
        error={errorFor("phone")}
        onChange={update("phone")}
      />
      <div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField
              id="zipCode"
              label={t("address.zipCode")}
              type="text"
              inputMode="numeric"
              value={fields.zipCode}
              autoComplete="shipping postal-code"
              error={errorFor("zipCode")}
              onChange={update("zipCode")}
            />
          </div>
          <button
            type="button"
            onClick={() => {
              void handleSearch();
            }}
            className={`h-12 shrink-0 rounded-[12px] bg-pine px-4 text-[14px] font-semibold text-frost ${
              errorFor("zipCode") !== undefined ? "mb-[26px]" : ""
            }`}
          >
            {t("address.findZip")}
          </button>
        </div>
        {searchError !== null && <p className="mt-1.5 text-[13px] text-cranberry">{searchError}</p>}
      </div>
      <TextField
        id="address1"
        label={t("address.address1")}
        type="text"
        value={fields.address1}
        autoComplete="shipping address-line1"
        error={errorFor("address1")}
        onChange={update("address1")}
      />
      <TextField
        id="address2"
        label={t("address.address2")}
        type="text"
        value={fields.address2}
        autoComplete="shipping address-line2"
        hint={t("address.address2Hint")}
        error={errorFor("address2")}
        onChange={update("address2")}
      />
      {formError !== null && (
        <p role="alert" className="rounded-[12px] bg-cranberry/10 px-3.5 py-2.5 text-[14px] text-cranberry">
          {formError}
        </p>
      )}
      <div className="flex gap-2">
        {onCancel !== undefined && (
          <button
            type="button"
            onClick={onCancel}
            className="h-[52px] flex-1 rounded-[14px] border border-frost-300 bg-white text-[15px] font-semibold text-pine"
          >
            {t("common.cancel")}
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="h-[52px] flex-[2] rounded-[14px] bg-cranberry text-[16px] font-bold text-white hover:bg-cranberry-700 disabled:bg-ash/50"
        >
          {saving ? t("common.saving") : submitLabel}
        </button>
      </div>
    </form>
  );
}
