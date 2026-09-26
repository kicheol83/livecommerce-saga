import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentFailure } from "@/components/payments/PaymentFailure";

export const metadata: Metadata = {
  title: "결제 실패"
};

export default function PaymentFailurePage() {
  return (
    <Suspense fallback={null}>
      <PaymentFailure />
    </Suspense>
  );
}
