import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { NavItem } from "@/components/NavLink";
import { getCurrentUser } from "@/lib/session";

const NAV: NavItem[] = [
  { href: "/customer", label: "Overview", exact: true },
  { href: "/customer/requests", label: "My requests" },
  { href: "/customer/profile", label: "My details" },
];

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "CUSTOMER") redirect("/admin");

  return (
    <AppShell user={user} nav={NAV}>
      {children}
    </AppShell>
  );
}
