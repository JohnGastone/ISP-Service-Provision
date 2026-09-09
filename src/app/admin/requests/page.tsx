import Link from "next/link";
import { listCustomers, listPools, listRequests } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { Card, CardHeader, EmptyState, ErrorNotice, PageHeading } from "@/components/ui";
import RequestRow from "./RequestRow";
import NewRequestForm from "./NewRequestForm";
import type { BandwidthPool, BandwidthRequest, Customer, RequestStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bandwidth requests" };

const FILTERS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
] as const;

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = FILTERS.some((f) => f.value === status) ? status! : "PENDING";

  const [requests, pools, customers] = await Promise.all([
    safeLoad<BandwidthRequest[]>(listRequests, []),
    safeLoad<BandwidthPool[]>(listPools, []),
    safeLoad<Customer[]>(listCustomers, []),
  ]);

  const error = requests.error ?? pools.error ?? customers.error;

  const poolById = new Map(pools.data.map((p) => [p.id, p]));
  const customerById = new Map(customers.data.map((c) => [c.id, c]));

  // The API has no status filter, so the list is narrowed here.
  const visible =
    active === "ALL"
      ? requests.data
      : requests.data.filter((r) => r.status === (active as RequestStatus));

  const counts = requests.data.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeading
        title="Bandwidth requests"
        subtitle="Approval is blocked when a request exceeds the capacity remaining in its pool."
      />

      {error ? (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-5 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const isActive = f.value === active;
              const count = f.value === "ALL" ? requests.data.length : (counts[f.value] ?? 0);
              return (
                <Link
                  key={f.value}
                  href={`/admin/requests?status=${f.value}`}
                  aria-current={isActive ? "page" : undefined}
                  className={
                    isActive
                      ? "inline-flex items-center gap-2 rounded-xl bg-brand-700 px-3.5 py-2 text-sm font-semibold text-white"
                      : "inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50"
                  }
                >
                  {f.label}
                  <span
                    className={
                      isActive
                        ? "rounded-full bg-white/20 px-1.5 text-xs tabular-nums"
                        : "rounded-full bg-slate-100 px-1.5 text-xs tabular-nums text-slate-500"
                    }
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>

          {visible.length === 0 ? (
            <Card>
              <CardHeader title={`${labelFor(active)} requests`} />
              <EmptyState
                title="Nothing here"
                description={
                  active === "PENDING"
                    ? "There are no requests waiting for a decision."
                    : "No requests match this filter."
                }
              />
            </Card>
          ) : (
            <div className="space-y-4">
              {visible.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  pool={poolById.get(request.poolId) ?? null}
                  customer={customerById.get(request.customerId) ?? null}
                />
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <NewRequestForm customers={customers.data} pools={pools.data} />
        </div>
      </div>
    </>
  );
}

function labelFor(status: string) {
  return FILTERS.find((f) => f.value === status)?.label ?? "All";
}
