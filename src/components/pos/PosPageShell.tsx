"use client";

import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PosPageShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-teal-500/15 text-teal-600 dark:text-teal-400 sm:h-12 sm:w-12">
          <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children ?? (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Coming soon</CardTitle>
            <CardDescription>
              This POS screen is scaffolded. Wire catalog, cart, and checkout next.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Use the sidebar switch to return to Property Management anytime.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
