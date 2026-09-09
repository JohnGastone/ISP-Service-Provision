import type { ReactNode } from "react";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";
import { NavLink, type NavItem } from "@/components/NavLink";
import type { AuthUser } from "@/lib/types";

export default function AppShell({
  user,
  nav,
  children,
}: {
  user: AuthUser;
  nav: NavItem[];
  children: ReactNode;
}) {
  const home = user.role === "ADMIN" ? "/admin" : "/customer";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link href={home} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white">
              ISP
            </span>
            <span className="text-sm font-semibold text-slate-900">Service Provision</span>
          </Link>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight text-slate-900">{user.fullName}</p>
              <p className="text-xs leading-tight text-slate-500">
                {user.role === "ADMIN" ? "Administrator" : "Customer"}
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Main" className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24 space-y-1">
            {nav.map((item) => (
              <NavLink key={item.href} item={item} />
            ))}
          </div>
        </nav>

        <main className="min-w-0 flex-1">
          {/* Horizontal nav on small screens, where the sidebar is hidden. */}
          <nav
            aria-label="Main"
            className="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 pb-3 md:hidden"
          >
            {nav.map((item) => (
              <div key={item.href} className="shrink-0">
                <NavLink item={item} />
              </div>
            ))}
          </nav>

          {children}
        </main>
      </div>
    </div>
  );
}
