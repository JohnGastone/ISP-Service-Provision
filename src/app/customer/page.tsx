import Link from "next/link";
import { listMyRequests } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { formatDate, formatMbps } from "@/lib/bandwidth";
import { getCurrentUser } from "@/lib/session";
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
import type { ServiceRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CustomerOverview() {
  const user = await getCurrentUser();
  const { data: requests, error } = await safeLoad<ServiceRequest[]>(listMyRequests, []);

  const approved = requests.filter((r) => r.status === "APPROVED");
  const pending = requests.filter((r) => r.status === "PENDING");

  // The active plan is the most recently approved allocation.
  const current = approved
    .slice()
    .sort((a, b) => new Date(b.decidedAt ?? b.createdAt).getTime() - new Date(a.decidedAt ?? a.createdAt).getTime())[0];

  return (
    <>
      <PageHeading
        title={`Karibu, ${user?.fullName?.split(" ")[0] ?? "there"}`}
        subtitle="Your current allocation and request history."
        action={
          <Link
            href="/customer/requests"
            className={primaryLinkClass}
          >
            Request bandwidth
          </Link>
        }
      />

      {error ? (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Current download"
          value={current ? formatMbps(current.requestedDownload) : "Not allocated"}
          tone={current ? "positive" : "default"}
          hint={current ? `Active since ${formatDate(current.decidedAt)}` : "No approved plan yet"}
        />
        <StatCard
          label="Current upload"
          value={current ? formatMbps(current.requestedUpload) : "Not allocated"}
          tone={current ? "positive" : "default"}
          hint={current ? "Approved allocation" : "No approved plan yet"}
        />
        <StatCard
          label="Pending requests"
          value={pending.length}
          tone={pending.length > 0 ? "warning" : "default"}
          hint={pending.length > 0 ? "Awaiting admin decision" : "Nothing in review"}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent requests"
          action={
            <Link
              href="/customer/requests"
              className="text-sm font-medium text-brand-700 hover:underline"
            >
              View all
            </Link>
          }
        />
        {requests.length === 0 ? (
          <EmptyState
            title="No requests yet"
            description="Submit a request and the ISP administrator will review your bandwidth allocation."
            action={
              <Link
                href="/customer/requests"
                className={primaryLinkClass}
              >
                Request bandwidth
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Submitted</Th>
                  <Th>Requested</Th>
                  <Th>Status</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.slice(0, 5).map((r) => (
                  <tr key={r.id}>
                    <Td className="text-slate-500">{formatDate(r.createdAt)}</Td>
                    <Td className="tabular-nums">
                      {formatMbps(r.requestedDownload)} ↓ · {formatMbps(r.requestedUpload)} ↑
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
