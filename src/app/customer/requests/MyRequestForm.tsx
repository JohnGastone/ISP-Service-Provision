"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/form";
import { Card, CardHeader, ErrorNotice } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { availability, checkAllocation, formatMbps } from "@/lib/bandwidth";
import { fieldErrorsOf, myRequestSchema } from "@/lib/validation";
import type { BandwidthPool } from "@/lib/types";

export default function MyRequestForm({
  pools,
  hasPending,
}: {
  pools: BandwidthPool[];
  hasPending: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    poolId: pools.length === 1 ? String(pools[0].id) : "",
    requestedDownloadMbps: "",
    requestedUploadMbps: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setSuccess(false);
    setFormError(null);
  }

  // Live capacity preview against the chosen pool, so the customer knows
  // whether the request can realistically be approved.
  const selectedPool = pools.find((p) => String(p.id) === values.poolId) ?? null;
  const down = Number(values.requestedDownloadMbps);
  const up = Number(values.requestedUploadMbps);
  const preview =
    selectedPool && Number.isFinite(down) && Number.isFinite(up) && (down > 0 || up > 0)
      ? checkAllocation(selectedPool, up || 0, down || 0)
      : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    setSuccess(false);

    const parsed = myRequestSchema.safeParse({
      poolId: values.poolId ? Number(values.poolId) : Number.NaN,
      requestedDownloadMbps: toNumber(values.requestedDownloadMbps),
      requestedUploadMbps: toNumber(values.requestedUploadMbps),
    });

    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/bandwidth/requests", { method: "POST", body: parsed.data });
      setValues((v) => ({ ...v, requestedDownloadMbps: "", requestedUploadMbps: "" }));
      setSuccess(true);
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ClientApiError ? error.message : "Could not submit your request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="sticky top-24">
      <CardHeader
        title="New request"
        subtitle="The administrator reviews available capacity before approving."
      />
      <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 py-5">
        {formError ? <ErrorNotice message={formError} /> : null}

        {success ? (
          <div
            role="status"
            className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800"
          >
            Request submitted. You will see the decision in your history.
          </div>
        ) : null}

        {hasPending ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            You already have a request awaiting a decision.
          </div>
        ) : null}

        <Field
          label="Service pool"
          htmlFor="poolId"
          error={errors.poolId}
          hint={
            pools.length > 0
              ? "Free capacity shown per pool — pick one that can cover your request."
              : undefined
          }
        >
          <Select
            id="poolId"
            value={values.poolId}
            invalid={Boolean(errors.poolId)}
            disabled={pools.length === 0}
            onChange={(e) => update("poolId", e.target.value)}
          >
            <option value="">
              {pools.length === 0 ? "No pools available" : "Select a pool…"}
            </option>
            {pools.map((p) => {
              const a = availability(p);
              return (
                <option key={p.id} value={p.id}>
                  Pool #{p.id} — {formatMbps(a.downloadRemaining)} ↓ /{" "}
                  {formatMbps(a.uploadRemaining)} ↑ free
                </option>
              );
            })}
          </Select>
        </Field>

        {pools.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
            No bandwidth pools could be loaded. Please contact the ISP administrator.
          </p>
        ) : null}

        <Field
          label="Download (Mbps)"
          htmlFor="requestedDownloadMbps"
          error={errors.requestedDownloadMbps}
        >
          <Input
            id="requestedDownloadMbps"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="50"
            value={values.requestedDownloadMbps}
            invalid={Boolean(errors.requestedDownloadMbps)}
            onChange={(e) => update("requestedDownloadMbps", e.target.value)}
          />
        </Field>

        <Field
          label="Upload (Mbps)"
          htmlFor="requestedUploadMbps"
          error={errors.requestedUploadMbps}
        >
          <Input
            id="requestedUploadMbps"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="20"
            value={values.requestedUploadMbps}
            invalid={Boolean(errors.requestedUploadMbps)}
            onChange={(e) => update("requestedUploadMbps", e.target.value)}
          />
        </Field>

        {preview ? (
          <p
            className={
              preview.ok
                ? "rounded-xl bg-accent-50 px-3.5 py-2.5 text-xs font-medium text-accent-800"
                : "rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs font-medium text-amber-900"
            }
          >
            {preview.ok
              ? "This pool has enough free capacity for your request."
              : "This exceeds the pool's free capacity — the administrator may not be able to approve it yet."}
          </p>
        ) : null}

        <Button
          type="submit"
          loading={submitting}
          disabled={pools.length === 0}
          className="w-full"
        >
          Submit request
        </Button>
      </form>
    </Card>
  );
}

function toNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}
