"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/form";
import { Card, CardHeader, ErrorNotice } from "@/components/ui";
import { ClientApiError, api } from "@/lib/client-api";
import { TZ_REGIONS, districtsFor, formatTzPhone, toE164 } from "@/lib/tz";
import { customerSchema, fieldErrorsOf } from "@/lib/validation";
import type { Customer } from "@/lib/types";

export default function CustomerForm() {
  const router = useRouter();

  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    region: "",
    district: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const districts = districtsFor(values.region);

  function update(key: keyof typeof values, value: string) {
    setValues((v) => {
      // Changing region invalidates any district chosen under the old one.
      if (key === "region") return { ...v, region: value, district: "" };
      return { ...v, [key]: value };
    });
    setErrors((e) => (e[key] ? { ...e, [key]: "" } : e));
    setFormError(null);
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const parsed = customerSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(fieldErrorsOf(parsed.error));
      return;
    }

    // The API accepts a nested `location` even though it returns it flattened.
    const payload = {
      name: parsed.data.name,
      email: parsed.data.email,
      phone: toE164(parsed.data.phone),
      location: { region: parsed.data.region, district: parsed.data.district },
    };

    setSubmitting(true);
    try {
      const created = await api<Customer>("/api/customers", { method: "POST", body: payload });
      router.push(`/admin/customers?created=${encodeURIComponent(created?.name ?? "Customer")}`);
      router.refresh();
    } catch (error) {
      if (error instanceof ClientApiError) {
        setFormError(error.message);
        // A duplicate email is reported in the ProblemDetail text; surface it
        // on the field the admin needs to change.
        if (/email/i.test(error.message) && /exist/i.test(error.message)) {
          setErrors((e) => ({ ...e, email: "A customer with this email already exists" }));
        }
      } else {
        setFormError("Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Register a customer"
        subtitle="Name, email, a Tanzanian mobile number and the service location."
      />

      <form onSubmit={onSubmit} noValidate className="space-y-5 px-6 py-5">
        {formError ? <ErrorNotice message={formError} /> : null}

        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="organization"
            placeholder="Asha Juma Mwinyi"
            value={values.name}
            invalid={Boolean(errors.name)}
            onChange={(e) => update("name", e.target.value)}
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Email address" htmlFor="email" error={errors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ops@acme.co.tz"
              value={values.email}
              invalid={Boolean(errors.email)}
              onChange={(e) => update("email", e.target.value)}
            />
          </Field>

          <Field
            label="Phone number"
            htmlFor="phone"
            error={errors.phone}
            hint={
              values.phone && !errors.phone
                ? `Sent as ${toE164(values.phone)}`
                : "Tanzanian mobile, e.g. 0712345678 or +255712345678"
            }
          >
            <Input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0712345678"
              value={values.phone}
              invalid={Boolean(errors.phone)}
              onChange={(e) => update("phone", e.target.value)}
            />
          </Field>
        </div>

        <fieldset className="grid gap-5 sm:grid-cols-2">
          <legend className="sr-only">Service location</legend>

          <Field label="Region" htmlFor="region" error={errors.region}>
            <Select
              id="region"
              name="region"
              value={values.region}
              invalid={Boolean(errors.region)}
              onChange={(e) => update("region", e.target.value)}
            >
              <option value="">Select a region…</option>
              {TZ_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="District"
            htmlFor="district"
            error={errors.district}
            hint={values.region ? undefined : "Choose a region first"}
          >
            <Select
              id="district"
              name="district"
              value={values.district}
              disabled={!values.region}
              invalid={Boolean(errors.district)}
              onChange={(e) => update("district", e.target.value)}
            >
              <option value="">
                {values.region ? "Select a district…" : "Select a region first"}
              </option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </Select>
          </Field>
        </fieldset>

        <div className="flex items-center gap-3 border-t border-slate-100 pt-5">
          <Button type="submit" loading={submitting}>
            Register customer
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

/** Kept for the details view, which renders the flattened response shape. */
export function formatCustomerPhone(phone: string): string {
  return formatTzPhone(phone);
}
