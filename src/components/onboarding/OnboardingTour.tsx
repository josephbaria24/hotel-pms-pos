"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCompleteOnboarding } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { ArrowRight, X } from "lucide-react";

type Step = {
  target: string;
  title: string;
  body: string;
  href?: string;
};

const STEPS: Step[] = [
  {
    target: "[data-tour='nav-dashboard']",
    title: "Your dashboard",
    body: "This is home. Occupancy, arrivals, and today’s numbers all live here.",
    href: "/dashboard",
  },
  {
    target: "[data-tour='nav-rooms']",
    title: "Rooms",
    body: "Add rooms, change status, and manage types from this page. Start here before taking a reservation.",
    href: "/rooms",
  },
  {
    target: "[data-tour='nav-guests']",
    title: "Guests & stays",
    body: "Create bookings, check guests in and out, and manage stay records from this hub.",
    href: "/guests",
  },
  {
    target: "[data-tour='nav-pos']",
    title: "Point of sale",
    body: "Use this switch to jump into restaurant POS — categories, menu, tables, and orders.",
    href: "/dashboard",
  },
  {
    target: "[data-tour='nav-pos-categories']",
    title: "POS categories",
    body: "Build food categories first, then items. This is the restaurant side of the hotel.",
    href: "/pos/categories",
  },
  {
    target: "[data-tour='nav-billing']",
    title: "Billing",
    body: "Record payments and keep folios balanced. When you are done exploring, finish or skip this tour anytime.",
    href: "/billing",
  },
];

function isVisibleTourTarget(el: Element): boolean {
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  if (rect.bottom < 0 || rect.right < 0) return false;
  if (rect.top > window.innerHeight || rect.left > window.innerWidth) return false;

  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return false;
  }

  let node: Element | null = el;
  while (node) {
    const cs = window.getComputedStyle(node);
    if (cs.display === "none" || cs.visibility === "hidden") return false;
    node = node.parentElement;
  }
  return true;
}

function findTourTarget(selector: string): Element | null {
  const matches = Array.from(document.querySelectorAll(selector));
  return matches.find(isVisibleTourTarget) ?? null;
}

export function OnboardingTour() {
  const { user, isLoading, refresh } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const complete = useCompleteOnboarding();
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);

  const active = !isLoading && !!user && !user.onboardingCompleted;

  useEffect(() => {
    setMounted(true);
  }, []);

  const current = STEPS[step];

  useLayoutEffect(() => {
    if (!active || !current) return;

    if (current.href && pathname !== current.href) {
      router.push(current.href);
      return;
    }

    const tick = () => {
      const el = findTourTarget(current.target);
      if (el) setRect(el.getBoundingClientRect());
      else setRect(null);
    };

    tick();
    const id = window.setInterval(tick, 200);
    window.addEventListener("resize", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", tick);
    };
  }, [active, current, pathname, router]);

  async function finish() {
    if (!user?.id) return;
    await complete.mutateAsync(user.id);
    await refresh();
  }

  function next() {
    if (step >= STEPS.length - 1) {
      void finish();
      return;
    }
    setStep((s) => s + 1);
  }

  if (!mounted || !active || !current) return null;

  const pad = 8;
  const highlight = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  const tooltipStyle = (() => {
    if (!highlight || typeof window === "undefined") {
      return { top: 80, left: 24 };
    }

    const cardW = Math.min(320, window.innerWidth - 32);
    const cardH = 190;
    const gap = 12;

    // Prefer right of target (sidebar / switch), else below, else above.
    const rightLeft = highlight.left + highlight.width + gap;
    if (rightLeft + cardW <= window.innerWidth - 16) {
      return {
        top: Math.min(
          Math.max(16, highlight.top),
          window.innerHeight - cardH - 16,
        ),
        left: rightLeft,
      };
    }

    const belowTop = highlight.top + highlight.height + gap;
    if (belowTop + cardH <= window.innerHeight - 16) {
      return {
        top: belowTop,
        left: Math.min(
          Math.max(16, highlight.left),
          window.innerWidth - cardW - 16,
        ),
      };
    }

    return {
      top: Math.max(16, highlight.top - cardH - gap),
      left: Math.min(
        Math.max(16, highlight.left),
        window.innerWidth - cardW - 16,
      ),
    };
  })();

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 bg-black/55" />
      {highlight && (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}
      <div
        className="absolute w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-card p-4 shadow-xl"
        style={tooltipStyle}
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </p>
          <button
            type="button"
            onClick={() => void finish()}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Skip tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 className="text-sm font-semibold">{current.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{current.body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => void finish()}>
            Skip
          </Button>
          <Button size="sm" onClick={next} disabled={complete.isPending}>
            {step >= STEPS.length - 1 ? "Finish" : "Next"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
