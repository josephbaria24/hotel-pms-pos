"use client";

import NextLink from "next/link";
import {
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  forwardRef,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";

/** Minimal wouter-compatible shim for Next.js App Router */

export function useLocation(): [string, (to: string) => void] {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const router = useRouter();
  const search = searchParams?.toString();
  const location = search ? `${pathname}?${search}` : pathname;

  const setLocation = (to: string) => {
    router.push(to);
  };

  return [location, setLocation];
}

export function useSearch(): string {
  const searchParams = useSearchParams();
  const s = searchParams?.toString() ?? "";
  return s ? `?${s}` : "";
}

export function useHashLocation(): [string, (to: string) => void] {
  return useLocation();
}

type LinkProps = {
  href: string;
  children?: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent) => void;
} & Omit<ComponentProps<"a">, "href">;

export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { href, children, className, onClick, ...rest },
  ref,
) {
  return (
    <NextLink
      ref={ref}
      href={href}
      className={className}
      onClick={onClick}
      {...rest}
    >
      {children}
    </NextLink>
  );
});

export function Router({ children }: { children?: ReactNode; base?: string; hook?: unknown }) {
  return <>{children}</>;
}

export function Route({ children }: { path?: string; component?: unknown; children?: ReactNode }) {
  return <>{children}</>;
}

export function Switch({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
