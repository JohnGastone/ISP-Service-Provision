import Link from "next/link";
import { listCustomers } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { formatTzPhone } from "@/lib/tz";
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeading,
  primaryLinkClass,
  Td,
  Th,
} from "@/components/ui";
import CustomerSearch from "./CustomerSearch";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; created?: string }>;
}) {
  const { q, created } = await searchParams;
  const { data: customers, error } = await safeLoad<Customer[]>(listCustomers, []);

  const query = (q ?? "").trim().toLowerCase();
  const visible = query
    ? customers.filter((c) =>
        [c.name, c.email, c.phone, c.district, c.region]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query)),
      )
    : customers;

  return (
    <>
      <PageHeading
        title="Customers"
        subtitle="Registered by the administrator, with validated Tanzanian contact details."
        action={
          <Link href="/admin/customers/new" className={primaryLinkClass}>
            Register customer
          </Link>
        }
      />

      {created ? (
        <div
          role="status"
          className="mb-6 rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800"
        >
          <strong className="font-semibold">{created}</strong> was registered successfully.
        </div>
      ) : null}

      {error ? (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <Card>
        <div className="border-b border-slate-100 px-6 py-4">
          <CustomerSearch initialQuery={q ?? ""} total={customers.length} shown={visible.length} />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title={query ? "No matching customers" : "No customers registered yet"}
            description={
              query
                ? "Try a different name, email, phone number or district."
                : "Register your first customer to start provisioning bandwidth."
            }
            action={
              query ? null : (
                <Link href="/admin/customers/new" className={primaryLinkClass}>
                  Register customer
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Location</Th>
                  <Th className="text-right">ID</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((c) => (
                  <tr key={c.id} className="transition hover:bg-slate-50/70">
                    <Td className="font-semibold text-slate-900">{c.name}</Td>
                    <Td>
                      <span className="block">{c.email}</span>
                      <span className="block text-xs tabular-nums text-slate-500">
                        {formatTzPhone(c.phone)}
                      </span>
                    </Td>
                    <Td>
                      <span className="block">{c.district}</span>
                      <span className="block text-xs text-slate-500">{c.region}</span>
                    </Td>
                    <Td className="text-right tabular-nums text-slate-500">#{c.id}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
