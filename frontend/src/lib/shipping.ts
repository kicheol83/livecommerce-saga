import type { DeliveryStatus, ShippingAddress } from "./types";

export type AddressErrors = Partial<Record<keyof ShippingAddress, string>>;

const PHONE_PATTERN = /^0\d{1,2}-?\d{3,4}-?\d{4}$/;
const ZIP_PATTERN = /^\d{5}$/;

export const FIELD_MESSAGES: Record<keyof ShippingAddress, string> = {
  recipientName: "받는 분 이름을 30자 이내로 입력해 주세요.",
  phone: "연락처를 010-1234-5678 형식으로 입력해 주세요.",
  zipCode: "우편번호 5자리를 입력해 주세요.",
  address1: "주소를 입력해 주세요.",
  address2: "상세 주소는 100자 이내로 입력해 주세요."
};

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

export const DELIVERY_STEPS = ["결제 완료", "상품 준비 중", "배송 시작", "배송 중", "배송 완료"];

const STEP_INDEX: Record<DeliveryStatus, number> = {
  PREPARING: 1,
  SHIPPED: 2,
  IN_TRANSIT: 3,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4
};

export const DELIVERY_HEADLINE: Record<DeliveryStatus, string> = {
  PREPARING: "상품을 준비하고 있어요",
  SHIPPED: "택배사에 상품을 전달했어요",
  IN_TRANSIT: "배송 중이에요",
  OUT_FOR_DELIVERY: "오늘 도착할 예정이에요",
  DELIVERED: "배송이 완료됐어요"
};

export function deliveryStepIndex(status: DeliveryStatus | null): number {
  return status === null ? 0 : STEP_INDEX[status];
}
