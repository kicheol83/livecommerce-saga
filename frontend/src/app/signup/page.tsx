import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { SignupForm } from "@/components/auth/SignupForm";

export const metadata: Metadata = {
  title: "회원가입"
};

export default function SignupPage() {
  return (
    <AuthShell title="회원가입" description="가입하면 채팅에 참여하고 라이브 특가 상품을 주문할 수 있어요.">
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
