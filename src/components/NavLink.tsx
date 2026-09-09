"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
  /** Match only the exact path — used for section index pages. */
  exact?: boolean;
}

export function NavLink({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative block rounded-xl px-3.5 py-2.5 text-sm font-semibold transition duration-150",
        active
          ? "bg-white text-brand-700 shadow-card ring-1 ring-brand-100"
          : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
      )}
    >
      {active ? (
        <span
          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-600"
          aria-hidden="true"
        />
      ) : null}
      {item.label}
    </Link>
  );
}
