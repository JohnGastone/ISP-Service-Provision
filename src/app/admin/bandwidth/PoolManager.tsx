"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input } from "@/components/form";
import { Card, CardHeader, ErrorNotice } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { availability, formatMbps } from "@/lib/bandwidth";
import { bandwidthPoolSchema, fieldErrorsOf } from "@/lib/validation";
import type { BandwidthPool } from "@/lib/types";

export function CreatePool() {
  const router = useRouter();
  const [values, setValues] = useState({ totalDownloadMbps: "", totalUploadMbps: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setFormError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = bandwidthPoolSchema.safeParse({
      totalDownloadMbps: toNumber(values.totalDownloadMbps),
      totalUploadMbps: toNumber(values.totalUploadMbps),
    });

    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    setSubmitting(true);
    try {
      await api("/api/bandwidth/pools", { method: "POST", body: parsed.data });
      setValues({ totalDownloadMbps: "", totalUploadMbps: "" });
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ClientApiError ? error.message : "Could not create the pool.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="sticky top-24">
      <CardHeader title="Create a pool" subtitle="Capacity purchased upstream" />
      <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 py-5">
        {formError ? <ErrorNotice message={formError} /> : null}

        <Field
          label="Total download (Mbps)"
          htmlFor="total-download"
          error={errors.totalDownloadMbps}
        >
          <Input
            id="total-download"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="1000"
            value={values.totalDownloadMbps}
            invalid={Boolean(errors.totalDownloadMbps)}
            onChange={(e) => update("totalDownloadMbps", e.target.value)}
          />
        </Field>

        <Field label="Total upload (Mbps)" htmlFor="total-upload" error={errors.totalUploadMbps}>
          <Input
            id="total-upload"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            placeholder="1000"
            value={values.totalUploadMbps}
            invalid={Boolean(errors.totalUploadMbps)}
            onChange={(e) => update("totalUploadMbps", e.target.value)}
          />
        </Field>

        <Button type="submit" loading={submitting} className="w-full">
          Create pool
        </Button>
      </form>
    </Card>
  );
}

/**
 * Adjusts a pool's totals. The API rejects (422) any total below what approved
 * requests already hold, so the allocated figure is shown as the floor.
 */
export function EditPoolTotals({ pool }: { pool: BandwidthPool }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [download, setDownload] = useState(String(pool.totalDownloadMbps));
  const [upload, setUpload] = useState(String(pool.totalUploadMbps));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const a = availability(pool);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = bandwidthPoolSchema.safeParse({
      totalDownloadMbps: toNumber(download),
      totalUploadMbps: toNumber(upload),
    });

    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    // Mirror the backend's 422 rule so the admin is told before submitting.
    const local: Record<string, string> = {};
    if (parsed.data.totalDownloadMbps < pool.downloadAllocatedMbps) {
      local.totalDownloadMbps = `Cannot go below ${formatMbps(
        pool.downloadAllocatedMbps,
      )} already allocated`;
    }
    if (parsed.data.totalUploadMbps < pool.uploadAllocatedMbps) {
      local.totalUploadMbps = `Cannot go below ${formatMbps(
        pool.uploadAllocatedMbps,
      )} already allocated`;
    }
    if (Object.keys(local).length) {
      setErrors(local);
      return;
    }

    setSubmitting(true);
    try {
      await api(`/api/bandwidth/pools/${pool.id}`, { method: "PUT", body: parsed.data });
      setOpen(false);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof ClientApiError ? error.message : "Could not update the pool.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <div className="border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Adjust capacity
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 border-t border-slate-100 pt-4">
      {formError ? <ErrorNotice message={formError} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Total download (Mbps)"
          htmlFor={`edit-download-${pool.id}`}
          error={errors.totalDownloadMbps}
          hint={`${formatMbps(pool.downloadAllocatedMbps)} allocated · ${formatMbps(
            a.downloadRemaining,
          )} free`}
        >
          <Input
            id={`edit-download-${pool.id}`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={download}
            invalid={Boolean(errors.totalDownloadMbps)}
            onChange={(e) => setDownload(e.target.value)}
          />
        </Field>

        <Field
          label="Total upload (Mbps)"
          htmlFor={`edit-upload-${pool.id}`}
          error={errors.totalUploadMbps}
          hint={`${formatMbps(pool.uploadAllocatedMbps)} allocated · ${formatMbps(
            a.uploadRemaining,
          )} free`}
        >
          <Input
            id={`edit-upload-${pool.id}`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={upload}
            invalid={Boolean(errors.totalUploadMbps)}
            onChange={(e) => setUpload(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex gap-3">
        <Button type="submit" loading={submitting}>
          Save totals
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setOpen(false);
            setErrors({});
            setFormError(null);
            setDownload(String(pool.totalDownloadMbps));
            setUpload(String(pool.totalUploadMbps));
          }}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** "" → undefined so the schema reports "required" rather than "must be a number". */
function toNumber(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}
