import Link from "next/link";
import { listPools, listRequests } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { Card, CardHeader, EmptyState, ErrorNotice, PageHeading } from "@/components/ui";
import RequestRow from "./RequestRow";
import type { BandwidthPool, ServiceRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS: { value: string; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = FILTERS.some((f) => f.value === status) ? status! : "PENDING";

  const [requests, pools] = await Promise.all([
    safeLoad<ServiceRequest[]>(
      () => listRequests(active === "ALL" ? undefined : active),
      [],
    ),
    safeLoad<BandwidthPool[]>(listPools, []),
  ]);

  const error = requests.error ?? pools.error;
  const poolById = new Map(pools.data.map((p) => [p.id, p]));

  return (
    <>
      <PageHeading
        title="Service requests"
        subtitle="Approval is blocked when a request exceeds the capacity left in its pool."
      />

      {error ? (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const isActive = f.value === active;
          return (
            <Link
              key={f.value}
              href={`/admin/requests?status=${f.value}`}
              aria-current={isActive ? "page" : undefined}
              className={
                isActive
                  ? "rounded-lg bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white"
                  : "rounded-lg bg-white px-3.5 py-1.5 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {requests.data.length === 0 ? (
        <Card>
          <CardHeader title={labelFor(active)} />
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
          {requests.data.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              pool={poolById.get(request.poolId) ?? null}
            />
          ))}
        </div>
      )}
    </>
  );
}

function labelFor(status: string) {
  const found = FILTERS.find((f) => f.value === status);
  return found ? `${found.label} requests` : "Requests";
}
