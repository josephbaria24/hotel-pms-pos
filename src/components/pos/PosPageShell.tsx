"use client";

import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PosPageShell({
  title,
  description,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-3 sm:space-y-6">
      <div className="flex items-center gap-2.5 sm:items-start sm:gap-4">
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
            "bg-teal-500/20 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400",
            "sm:h-12 sm:w-12 sm:rounded-2xl",
          )}
        >
          <Icon className="h-4 w-4 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight sm:text-2xl">{title}</h1>
          <p className="hidden text-sm text-muted-foreground sm:block">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
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
