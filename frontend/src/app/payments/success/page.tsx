import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentSuccess } from "@/components/payments/PaymentSuccess";

export const metadata: Metadata = {
  title: "결제 확인"
};

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={null}>
      <PaymentSuccess />
    </Suspense>
  );
}
