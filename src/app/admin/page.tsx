import Link from "next/link";
import { listCustomers, listPools, listRequests } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { availability, checkRequest, formatMbps, formatDate } from "@/lib/bandwidth";
import {
  Card,
  CardHeader,
  EmptyState,
  ErrorNotice,
  PageHeading,
  primaryLinkClass,
  StatCard,
  StatusBadge,
  Td,
  Th,
  UsageBar,
} from "@/components/ui";
import type { BandwidthPool, Customer, ServiceRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [pools, customers, pending] = await Promise.all([
    safeLoad<BandwidthPool[]>(listPools, []),
    safeLoad<Customer[]>(listCustomers, []),
    safeLoad<ServiceRequest[]>(() => listRequests("PENDING"), []),
  ]);

  const error = pools.error ?? customers.error ?? pending.error;

  const totals = pools.data.reduce(
    (acc, p) => {
      const a = availability(p);
      return {
        totalUpload: acc.totalUpload + p.totalUpload,
        totalDownload: acc.totalDownload + p.totalDownload,
        uploadRemaining: acc.uploadRemaining + a.uploadRemaining,
        downloadRemaining: acc.downloadRemaining + a.downloadRemaining,
      };
    },
    { totalUpload: 0, totalDownload: 0, uploadRemaining: 0, downloadRemaining: 0 },
  );

  const uploadUsedPct =
    totals.totalUpload > 0
      ? ((totals.totalUpload - totals.uploadRemaining) / totals.totalUpload) * 100
      : 0;
  const downloadUsedPct =
    totals.totalDownload > 0
      ? ((totals.totalDownload - totals.downloadRemaining) / totals.totalDownload) * 100
      : 0;

  // Requests that cannot be met by their own pool — the admin needs to see these first.
  const poolById = new Map(pools.data.map((p) => [p.id, p]));
  const blocked = pending.data.filter((r) => {
    const pool = poolById.get(r.poolId);
    return pool ? !checkRequest(pool, r).ok : false;
  });

  return (
    <>
      <PageHeading
        title="Dashboard"
        subtitle="Bandwidth capacity, customers and requests awaiting a decision."
      />

      {error ? (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Customers" value={customers.data.length} hint="Registered accounts" />
        <StatCard
          label="Pending requests"
          value={pending.data.length}
          tone={pending.data.length > 0 ? "warning" : "default"}
          hint="Awaiting approval"
        />
        <StatCard
          label="Download available"
          value={formatMbps(totals.downloadRemaining)}
          tone={downloadUsedPct >= 90 ? "danger" : "positive"}
          hint={`of ${formatMbps(totals.totalDownload)} total`}
        />
        <StatCard
          label="Upload available"
          value={formatMbps(totals.uploadRemaining)}
          tone={uploadUsedPct >= 90 ? "danger" : "positive"}
          hint={`of ${formatMbps(totals.totalUpload)} total`}
        />
      </div>

      {blocked.length > 0 ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong className="font-semibold">{blocked.length}</strong>{" "}
          pending {blocked.length === 1 ? "request exceeds" : "requests exceed"} the capacity left
          in the assigned pool. Top up the pool before approving.{" "}
          <Link href="/admin/requests" className="font-medium underline underline-offset-2">
            Review requests
          </Link>
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Pool utilisation"
            subtitle="Allocated versus funded capacity"
            action={
              <Link
                href="/admin/bandwidth"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Manage
              </Link>
            }
          />
          {pools.data.length === 0 ? (
            <EmptyState
              title="No bandwidth pools yet"
              description="Create a pool and fund it with total upload and download capacity before approving requests."
              action={
                <Link
                  href="/admin/bandwidth"
                  className={primaryLinkClass}
                >
                  Create a pool
                </Link>
              }
            />
          ) : (
            <div className="space-y-6 px-6 py-5">
              {pools.data.map((pool) => {
                const a = availability(pool);
                return (
                  <div key={pool.id}>
                    <p className="mb-3 text-sm font-semibold text-slate-900">
                      {pool.name ?? `Pool #${pool.id}`}
                    </p>
                    <div className="space-y-4">
                      <UsageBar
                        label="Download"
                        usedPct={a.downloadUsedPct}
                        caption={`${formatMbps(a.downloadRemaining)} available of ${formatMbps(
                          pool.totalDownload,
                        )}`}
                      />
                      <UsageBar
                        label="Upload"
                        usedPct={a.uploadUsedPct}
                        caption={`${formatMbps(a.uploadRemaining)} available of ${formatMbps(
                          pool.totalUpload,
                        )}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Awaiting approval"
            subtitle="Oldest first"
            action={
              <Link
                href="/admin/requests"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                View all
              </Link>
            }
          />
          {pending.data.length === 0 ? (
            <EmptyState title="Nothing pending" description="All requests have been decided." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Customer</Th>
                    <Th>Requested</Th>
                    <Th>Submitted</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pending.data.slice(0, 6).map((r) => (
                    <tr key={r.id}>
                      <Td className="font-medium text-slate-900">{r.customer?.name ?? "—"}</Td>
                      <Td className="tabular-nums">
                        {formatMbps(r.requestedDownload)} ↓ · {formatMbps(r.requestedUpload)} ↑
                      </Td>
                      <Td className="text-slate-500">{formatDate(r.createdAt)}</Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
