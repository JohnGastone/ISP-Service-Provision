import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import type { NavItem } from "@/components/NavLink";
import { getCurrentUser } from "@/lib/session";

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/bandwidth", label: "Bandwidth pools" },
  { href: "/admin/requests", label: "Requests" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <AppShell user={user} nav={NAV}>
      {children}
    </AppShell>
  );
}
