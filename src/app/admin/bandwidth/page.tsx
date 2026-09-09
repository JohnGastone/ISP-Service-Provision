import { listPools, listRequests } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { availability, formatMbps } from "@/lib/bandwidth";
import { Card, CardHeader, ErrorNotice, PageHeading, StatCard, UsageBar } from "@/components/ui";
import { CreatePool, EditPoolTotals } from "./PoolManager";
import type { BandwidthPool, BandwidthRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Bandwidth pools" };

export default async function BandwidthPage() {
  const [pools, requests] = await Promise.all([
    safeLoad<BandwidthPool[]>(listPools, []),
    safeLoad<BandwidthRequest[]>(listRequests, []),
  ]);

  const totals = pools.data.reduce(
    (acc, p) => {
      const a = availability(p);
      return {
        upload: acc.upload + p.totalUploadMbps,
        download: acc.download + p.totalDownloadMbps,
        uploadFree: acc.uploadFree + a.uploadRemaining,
        downloadFree: acc.downloadFree + a.downloadRemaining,
      };
    },
    { upload: 0, download: 0, uploadFree: 0, downloadFree: 0 },
  );

  // How many approved allocations each pool is currently carrying.
  const approvedByPool = new Map<number, number>();
  for (const r of requests.data) {
    if (r.status === "APPROVED") {
      approvedByPool.set(r.poolId, (approvedByPool.get(r.poolId) ?? 0) + 1);
    }
  }

  return (
    <>
      <PageHeading
        title="Bandwidth pools"
        subtitle="Fund pools with total capacity. Approved requests draw down what remains."
      />

      {pools.error ? (
        <div className="mb-6">
          <ErrorNotice message={pools.error} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total download" value={formatMbps(totals.download)} hint="Funded capacity" />
        <StatCard
          label="Download remaining"
          value={formatMbps(totals.downloadFree)}
          tone={totals.downloadFree <= 0 ? "danger" : "positive"}
          hint="Unallocated"
        />
        <StatCard label="Total upload" value={formatMbps(totals.upload)} hint="Funded capacity" />
        <StatCard
          label="Upload remaining"
          value={formatMbps(totals.uploadFree)}
          tone={totals.uploadFree <= 0 ? "danger" : "positive"}
          hint="Unallocated"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {pools.data.length === 0 ? (
            <Card>
              <CardHeader title="Pools" subtitle="No pools created yet" />
              <p className="px-6 py-12 text-center text-sm text-slate-500">
                Create a pool using the form to start allocating bandwidth.
              </p>
            </Card>
          ) : (
            pools.data.map((pool) => {
              const a = availability(pool);
              const approved = approvedByPool.get(pool.id) ?? 0;
              return (
                <Card key={pool.id}>
                  <CardHeader
                    title={`Pool #${pool.id}`}
                    subtitle={`${approved} approved ${
                      approved === 1 ? "allocation" : "allocations"
                    }`}
                  />
                  <div className="space-y-5 px-6 py-5">
                    <UsageBar
                      label="Download"
                      usedPct={a.downloadUsedPct}
                      caption={`${formatMbps(pool.downloadAllocatedMbps)} allocated · ${formatMbps(
                        a.downloadRemaining,
                      )} remaining of ${formatMbps(pool.totalDownloadMbps)}`}
                    />
                    <UsageBar
                      label="Upload"
                      usedPct={a.uploadUsedPct}
                      caption={`${formatMbps(pool.uploadAllocatedMbps)} allocated · ${formatMbps(
                        a.uploadRemaining,
                      )} remaining of ${formatMbps(pool.totalUploadMbps)}`}
                    />
                    <EditPoolTotals pool={pool} />
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <div className="lg:col-span-1">
          <CreatePool />
        </div>
      </div>
    </>
  );
}
