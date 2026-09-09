"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/form";
import { Card, ErrorNotice, StatusBadge, cn } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { availability, checkRequest, formatDate, formatMbps } from "@/lib/bandwidth";
import { formatTzPhone } from "@/lib/tz";
import type { BandwidthPool, ServiceRequest } from "@/lib/types";

export default function RequestRow({
  request,
  pool,
}: {
  request: ServiceRequest;
  pool: BandwidthPool | null;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = request.status === "PENDING";
  const check = pool ? checkRequest(pool, request) : null;
  const free = pool ? availability(pool) : null;
  // Without the pool we cannot verify capacity, so approval stays blocked.
  const canApprove = pending && Boolean(check?.ok);

  async function decide(action: "approve" | "reject") {
    setError(null);
    setBusy(action);
    try {
      await api(`/api/service-requests/${request.id}/${action}`, {
        method: "POST",
        body: { note: note.trim() || undefined },
      });
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ClientApiError ? err.message : `Could not ${action} this request.`,
      );
      setBusy(null);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div>
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-slate-900">
              {request.customer?.name ?? "Unknown customer"}
            </h3>
            <StatusBadge status={request.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {request.customer?.email}
            {request.customer?.phone ? ` · ${formatTzPhone(request.customer.phone)}` : ""}
          </p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>Request #{request.id}</p>
          <p>{formatDate(request.createdAt)}</p>
        </div>
      </div>

      <div className="grid gap-5 px-6 py-5 sm:grid-cols-3">
        <Figure label="Requested download" value={formatMbps(request.requestedDownload)} />
        <Figure label="Requested upload" value={formatMbps(request.requestedUpload)} />
        <Figure
          label="Pool"
          value={pool ? pool.name ?? `Pool #${pool.id}` : `#${request.poolId} (not found)`}
          hint={
            free
              ? `${formatMbps(free.downloadRemaining)} ↓ · ${formatMbps(free.uploadRemaining)} ↑ available`
              : "Capacity unknown"
          }
        />
      </div>

      {pending ? (
        <div className="border-t border-slate-200 px-6 py-4">
          {/* The capacity verdict, shown before the admin commits to a decision. */}
          <div
            className={cn(
              "rounded-lg px-4 py-3 text-sm",
              !pool
                ? "bg-slate-50 text-slate-700"
                : check?.ok
                  ? "bg-emerald-50 text-emerald-800"
                  : "bg-red-50 text-red-800",
            )}
          >
            {!pool ? (
              <p>
                Pool #{request.poolId} could not be loaded, so remaining capacity cannot be
                verified. Approval is disabled.
              </p>
            ) : check?.ok ? (
              <p>
                <strong className="font-semibold">Sufficient capacity.</strong> After approval:{" "}
                {formatMbps(free!.downloadRemaining - request.requestedDownload)} ↓ ·{" "}
                {formatMbps(free!.uploadRemaining - request.requestedUpload)} ↑ would remain.
              </p>
            ) : (
              <div>
                <p className="font-semibold">Insufficient capacity — cannot approve.</p>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                  {check!.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
                <p className="mt-1.5">Add capacity to the pool, or reject the request.</p>
              </div>
            )}
          </div>

          {error ? (
            <div className="mt-4">
              <ErrorNotice message={error} />
            </div>
          ) : null}

          {showReject ? (
            <div className="mt-4">
              <label
                htmlFor={`note-${request.id}`}
                className="block text-sm font-medium text-slate-700"
              >
                Reason for rejection
              </label>
              <Input
                id={`note-${request.id}`}
                className="mt-1.5"
                placeholder="Shared with the customer"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => decide("approve")}
              loading={busy === "approve"}
              disabled={!canApprove || busy !== null}
              title={canApprove ? undefined : "Not enough remaining bandwidth in the pool"}
            >
              Approve
            </Button>

            {showReject ? (
              <>
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => decide("reject")}
                  loading={busy === "reject"}
                  disabled={busy !== null}
                >
                  Confirm rejection
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setShowReject(false);
                    setNote("");
                  }}
                  disabled={busy !== null}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowReject(true)}
                disabled={busy !== null}
              >
                Reject
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-sm text-slate-600">
          Decided {formatDate(request.decidedAt)}
          {request.decisionNote ? ` — ${request.decisionNote}` : ""}
        </div>
      )}
    </Card>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}
