import Link from "next/link";
import { listCustomers } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { formatTzPhone } from "@/lib/tz";
import { formatDate } from "@/lib/bandwidth";
import {
  Card,
  EmptyState,
  ErrorNotice,
  PageHeading,
  Td,
  Th,
} from "@/components/ui";
import CustomerSearch from "./CustomerSearch";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { data: customers, error } = await safeLoad<Customer[]>(listCustomers, []);

  const query = (q ?? "").trim().toLowerCase();
  const visible = query
    ? customers.filter((c) =>
        [c.name, c.email, c.phone, c.location?.district, c.location?.region]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(query)),
      )
    : customers;

  return (
    <>
      <PageHeading
        title="Customers"
        subtitle="Accounts are created here — customers sign in with the credentials you issue."
        action={
          <Link
            href="/admin/customers/new"
            className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Register customer
          </Link>
        }
      />

      {error ? (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <Card>
        <div className="border-b border-slate-200 px-5 py-4">
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
                <Link
                  href="/admin/customers/new"
                  className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Register customer
                </Link>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Name</Th>
                  <Th>Contact</Th>
                  <Th>Location</Th>
                  <Th>Registered</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <Td className="font-medium text-slate-900">{c.name}</Td>
                    <Td>
                      <span className="block">{c.email}</span>
                      <span className="block text-xs text-slate-500 tabular-nums">
                        {formatTzPhone(c.phone)}
                      </span>
                    </Td>
                    <Td>
                      <span className="block">{c.location?.district ?? "—"}</span>
                      <span className="block text-xs text-slate-500">
                        {c.location?.region ?? ""}
                      </span>
                    </Td>
                    <Td className="text-slate-500">{formatDate(c.createdAt)}</Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        Edit
                      </Link>
                    </Td>
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
