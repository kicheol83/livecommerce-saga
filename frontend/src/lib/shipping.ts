import type { DeliveryStatus, ShippingAddress } from "./types";
import { translatedList, translatedRecord } from "@/i18n/core";

export type AddressErrors = Partial<Record<keyof ShippingAddress, string>>;

const PHONE_PATTERN = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
const ZIP_PATTERN = /^\d{5}$/;

export const FIELD_MESSAGES: Record<keyof ShippingAddress, string> = translatedRecord({
  recipientName: "shipping.error.recipientName",
  phone: "shipping.error.phone",
  zipCode: "shipping.error.zipCode",
  address1: "shipping.error.address1",
  address2: "shipping.error.address2"
});

export function emptyAddress(): ShippingAddress {
  return { recipientName: "", phone: "", zipCode: "", address1: "", address2: "" };
}

export function normalizeAddress(address: ShippingAddress): ShippingAddress {
  const detail = address.address2?.trim() ?? "";
  return {
    recipientName: address.recipientName.trim(),
    phone: address.phone.trim(),
    zipCode: address.zipCode.trim(),
    address1: address.address1.trim(),
    address2: detail === "" ? null : detail
  };
}

export function validateAddress(address: ShippingAddress): AddressErrors {
  const normalized = normalizeAddress(address);
  const errors: AddressErrors = {};
  if (normalized.recipientName === "" || normalized.recipientName.length > 30) {
    errors.recipientName = FIELD_MESSAGES.recipientName;
  }
  if (!PHONE_PATTERN.test(normalized.phone)) {
    errors.phone = FIELD_MESSAGES.phone;
  }
  if (!ZIP_PATTERN.test(normalized.zipCode)) {
    errors.zipCode = FIELD_MESSAGES.zipCode;
  }
  if (normalized.address1 === "" || normalized.address1.length > 200) {
    errors.address1 = FIELD_MESSAGES.address1;
  }
  if ((normalized.address2?.length ?? 0) > 100) {
    errors.address2 = FIELD_MESSAGES.address2;
  }
  return errors;
}

export function addressLine(address: ShippingAddress): string {
  return address.address2 === null || address.address2 === "" ? address.address1 : `${address.address1} ${address.address2}`;
}

export const DELIVERY_STEPS = translatedList([
  "delivery.step.paid",
  "delivery.step.preparing",
  "delivery.step.shipped",
  "delivery.step.inTransit",
  "delivery.step.delivered"
]);

const STEP_INDEX: Record<DeliveryStatus, number> = {
  PREPARING: 1,
  SHIPPED: 2,
  IN_TRANSIT: 3,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4
};

export const DELIVERY_HEADLINE: Record<DeliveryStatus, string> = translatedRecord({
  PREPARING: "delivery.headline.PREPARING",
  SHIPPED: "delivery.headline.SHIPPED",
  IN_TRANSIT: "delivery.headline.IN_TRANSIT",
  OUT_FOR_DELIVERY: "delivery.headline.OUT_FOR_DELIVERY",
  DELIVERED: "delivery.headline.DELIVERED"
});

export function deliveryStepIndex(status: DeliveryStatus | null): number {
  return status === null ? 0 : STEP_INDEX[status];
}
