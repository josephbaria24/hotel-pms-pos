"use client";

import { SidebarLayout } from "@/components/layout/SidebarLayout";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarLayout>
      {children}
      <OnboardingTour />
    </SidebarLayout>
  );
}

