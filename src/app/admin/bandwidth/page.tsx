import { listPools } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { availability, formatMbps } from "@/lib/bandwidth";
import { Card, CardHeader, ErrorNotice, PageHeading, StatCard, UsageBar } from "@/components/ui";
import PoolManager from "./PoolManager";
import type { BandwidthPool } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BandwidthPage() {
  const { data: pools, error } = await safeLoad<BandwidthPool[]>(listPools, []);

  const totals = pools.reduce(
    (acc, p) => {
      const a = availability(p);
      return {
        upload: acc.upload + p.totalUpload,
        download: acc.download + p.totalDownload,
        uploadFree: acc.uploadFree + a.uploadRemaining,
        downloadFree: acc.downloadFree + a.downloadRemaining,
      };
    },
    { upload: 0, download: 0, uploadFree: 0, downloadFree: 0 },
  );

  return (
    <>
      <PageHeading
        title="Bandwidth pools"
        subtitle="Fund pools with total capacity. Approvals draw down what is left."
      />

      {error ? (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total download" value={formatMbps(totals.download)} hint="Funded capacity" />
        <StatCard
          label="Download available"
          value={formatMbps(totals.downloadFree)}
          tone={totals.downloadFree <= 0 ? "danger" : "positive"}
          hint="Unallocated"
        />
        <StatCard label="Total upload" value={formatMbps(totals.upload)} hint="Funded capacity" />
        <StatCard
          label="Upload available"
          value={formatMbps(totals.uploadFree)}
          tone={totals.uploadFree <= 0 ? "danger" : "positive"}
          hint="Unallocated"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {pools.length === 0 ? (
            <Card>
              <CardHeader title="Pools" subtitle="No pools created yet" />
              <p className="px-6 py-10 text-center text-sm text-slate-500">
                Create a pool using the form to start allocating bandwidth.
              </p>
            </Card>
          ) : (
            pools.map((pool) => {
              const a = availability(pool);
              return (
                <Card key={pool.id}>
                  <CardHeader
                    title={pool.name ?? `Pool #${pool.id}`}
                    subtitle={`Pool ID ${pool.id}`}
                  />
                  <div className="space-y-5 px-6 py-5">
                    <UsageBar
                      label="Download"
                      usedPct={a.downloadUsedPct}
                      caption={`${formatMbps(pool.downloadAllocated)} allocated · ${formatMbps(
                        a.downloadRemaining,
                      )} available of ${formatMbps(pool.totalDownload)}`}
                    />
                    <UsageBar
                      label="Upload"
                      usedPct={a.uploadUsedPct}
                      caption={`${formatMbps(pool.uploadAllocated)} allocated · ${formatMbps(
                        a.uploadRemaining,
                      )} available of ${formatMbps(pool.totalUpload)}`}
                    />
                    <PoolManager mode="top-up" pool={pool} />
                  </div>
                </Card>
              );
            })
          )}
        </div>

        <div className="lg:col-span-1">
          <PoolManager mode="create" />
        </div>
      </div>
    </>
  );
}
