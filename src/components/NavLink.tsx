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
        "block rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-brand-50 text-brand-700"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      )}
    >
      {item.label}
    </Link>
  );
}
