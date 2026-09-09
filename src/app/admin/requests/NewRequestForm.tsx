"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/form";
import { Card, CardHeader, ErrorNotice } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { availability, checkAllocation, formatMbps } from "@/lib/bandwidth";
import { bandwidthRequestSchema, fieldErrorsOf } from "@/lib/validation";
import type { BandwidthPool, Customer } from "@/lib/types";

/**
 * Requests are raised by the administrator on a customer's behalf — the API
 * scopes POST /api/bandwidth/requests to admin accounts.
 */
export default function NewRequestForm({
  customers,
  pools,
}: {
  customers: Customer[];
  pools: BandwidthPool[];
}) {
  const router = useRouter();
  const [values, setValues] = useState({
    customerId: "",
    poolId: pools.length === 1 ? String(pools[0].id) : "",
    requestedDownloadMbps: "",
    requestedUploadMbps: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setSuccess(null);
    setFormError(null);
  }

  // Live capacity preview against the selected pool.
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
    setSuccess(null);

    const parsed = bandwidthRequestSchema.safeParse({
      customerId: values.customerId ? Number(values.customerId) : Number.NaN,
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
      setSuccess("Request created as pending.");
      router.refresh();
    } catch (error) {
      setFormError(
        error instanceof ClientApiError ? error.message : "Could not submit the request.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="sticky top-24">
      <CardHeader title="New request" subtitle="Raised on behalf of a customer" />
      <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 py-5">
        {formError ? <ErrorNotice message={formError} /> : null}

        {success ? (
          <div
            role="status"
            className="rounded-xl border border-accent-200 bg-accent-50 px-4 py-3 text-sm text-accent-800"
          >
            {success}
          </div>
        ) : null}

        <Field label="Customer" htmlFor="customerId" error={errors.customerId}>
          <Select
            id="customerId"
            value={values.customerId}
            invalid={Boolean(errors.customerId)}
            disabled={customers.length === 0}
            onChange={(e) => update("customerId", e.target.value)}
          >
            <option value="">
              {customers.length === 0 ? "No customers registered" : "Select a customer…"}
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.district}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Bandwidth pool" htmlFor="poolId" error={errors.poolId}>
          <Select
            id="poolId"
            value={values.poolId}
            invalid={Boolean(errors.poolId)}
            disabled={pools.length === 0}
            onChange={(e) => update("poolId", e.target.value)}
          >
            <option value="">{pools.length === 0 ? "No pools created" : "Select a pool…"}</option>
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
            placeholder="500"
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
            placeholder="400"
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
              ? "Pool #" + selectedPool!.id + " can cover this — it should approve cleanly."
              : "This exceeds the pool's remaining capacity. It can be created, but approval will fail until the pool total is raised."}
          </p>
        ) : null}

        <Button
          type="submit"
          loading={submitting}
          disabled={customers.length === 0 || pools.length === 0}
          className="w-full"
        >
          Create request
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
