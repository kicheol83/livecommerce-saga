import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "겨울 니트 세트 라이브 특가",
  description: "실시간 라이브 커머스 데모"
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#16302B"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="break-keep bg-pine font-sans text-pine antialiased">{children}</body>
    </html>
  );
}
