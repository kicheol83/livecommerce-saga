import { Suspense } from "react";
import { LiveRoom } from "@/components/live/LiveRoom";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <LiveRoom />
    </Suspense>
  );
}
