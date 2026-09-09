"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/form";

export default function CustomerSearch({
  initialQuery,
  total,
  shown,
}: {
  initialQuery: string;
  total: number;
  shown: number;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [pending, startTransition] = useTransition();

  // Push the query into the URL after a pause so the list stays shareable.
  useEffect(() => {
    if (value === initialQuery) return;
    const timer = setTimeout(() => {
      const url = value.trim() ? `/admin/customers?q=${encodeURIComponent(value.trim())}` : "/admin/customers";
      startTransition(() => router.replace(url));
    }, 300);
    return () => clearTimeout(timer);
  }, [value, initialQuery, router]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="w-full max-w-sm">
        <label htmlFor="customer-search" className="sr-only">
          Search customers
        </label>
        <Input
          id="customer-search"
          type="search"
          placeholder="Search by name, email, phone or district"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <p className="text-sm text-slate-500" aria-live="polite">
        {pending ? "Filtering…" : `Showing ${shown} of ${total}`}
      </p>
    </div>
  );
}
