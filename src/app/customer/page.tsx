import Link from "next/link";
import { getMyProfile, listMyRequests } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { formatDate, formatMbps } from "@/lib/bandwidth";
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
} from "@/components/ui";
import type { BandwidthRequest, Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomerOverview() {
  const [profile, requests] = await Promise.all([
    safeLoad<Customer | null>(getMyProfile, null),
    safeLoad<BandwidthRequest[]>(listMyRequests, []),
  ]);

  const approved = requests.data.filter((r) => r.status === "APPROVED");
  const pending = requests.data.filter((r) => r.status === "PENDING");

  // Everything approved is allocated to this customer, so the active plan is
  // the sum of approved requests rather than only the latest one.
  const totals = approved.reduce(
    (acc, r) => ({
      download: acc.download + r.requestedDownloadMbps,
      upload: acc.upload + r.requestedUploadMbps,
    }),
    { download: 0, upload: 0 },
  );

  const firstName = profile.data?.name?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeading
        title={`Karibu, ${firstName}`}
        subtitle="Your current allocation and request history."
        action={
          <Link href="/customer/requests" className={primaryLinkClass}>
            Request bandwidth
          </Link>
        }
      />

      {requests.error ? (
        <div className="mb-6">
          <ErrorNotice message={requests.error} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Allocated download"
          value={approved.length ? formatMbps(totals.download) : "Not allocated"}
          tone={approved.length ? "positive" : "default"}
          hint={
            approved.length
              ? `Across ${approved.length} approved ${
                  approved.length === 1 ? "request" : "requests"
                }`
              : "No approved plan yet"
          }
        />
        <StatCard
          label="Allocated upload"
          value={approved.length ? formatMbps(totals.upload) : "Not allocated"}
          tone={approved.length ? "positive" : "default"}
          hint={approved.length ? "Active allocation" : "No approved plan yet"}
        />
        <StatCard
          label="Pending requests"
          value={pending.length}
          tone={pending.length > 0 ? "warning" : "default"}
          hint={pending.length > 0 ? "Awaiting a decision" : "Nothing in review"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent requests"
          action={
            <Link
              href="/customer/requests"
              className="text-sm font-semibold text-brand-700 hover:underline"
            >
              View all
            </Link>
          }
        />
        {requests.data.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Submit a request and the administrator will review it against available capacity."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <Th>Submitted</Th>
                  <Th>Requested</Th>
                  <Th>Status</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.data.slice(0, 5).map((r) => (
                  <tr key={r.id}>
                    <Td className="text-slate-500">{formatDate(r.requestedAt)}</Td>
                    <Td className="tabular-nums">
                      {formatMbps(r.requestedDownloadMbps)} ↓ ·{" "}
                      {formatMbps(r.requestedUploadMbps)} ↑
                    </Td>
                    <Td>
                      <StatusBadge status={r.status} />
                    </Td>
                    <Td className="text-slate-500">{r.decisionNote ?? "—"}</Td>
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
