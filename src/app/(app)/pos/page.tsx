"use client";

import { Suspense } from "react";
import { PosRegisterView } from "@/components/pos/PosRegisterView";

export default function PosRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-center text-sm text-muted-foreground">
          Loading register…
        </div>
      }
    >
      <PosRegisterView />
    </Suspense>
  );
}
