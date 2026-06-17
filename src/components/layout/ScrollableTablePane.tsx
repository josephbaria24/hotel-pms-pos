import { cn } from "@/lib/utils";

type ScrollableTablePaneProps = {
  children: React.ReactNode;
  className?: string;
  /** Lower bound as a fraction of the viewport height (helps short windows). */
  minVh?: number;
  /** Space reserved above the pane (title, toolbar, chrome) in rem — subtracted from 100dvh. */
  offsetRem?: number;
  /** Omit card-style border/background (e.g. inside another Card). */
  frameless?: boolean;
};

/**
 * Constrains tabular content to a viewport-relative height with internal scrolling.
 */
export function ScrollableTablePane({
  children,
  className,
  minVh = 28,
  offsetRem = 11,
  frameless = false,
}: ScrollableTablePaneProps) {
  return (
    <div
      className={cn(
        "overflow-auto",
        frameless ? "" : "rounded-md border bg-card",
        className,
      )}
      style={{
        minHeight: `${minVh}vh`,
        maxHeight: `min(70vh, calc(100dvh - ${offsetRem}rem))`,
      }}
    >
      {children}
    </div>
  );
}
