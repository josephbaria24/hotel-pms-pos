import { SidebarLayout } from "@/components/layout/SidebarLayout";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SidebarLayout>{children}</SidebarLayout>;
}
