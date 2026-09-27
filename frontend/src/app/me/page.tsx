import type { Metadata } from "next";
import { MyPage } from "@/components/me/MyPage";

export const metadata: Metadata = {
  title: "내 주문"
};

export default function MyOrdersPage() {
  return <MyPage />;
}
