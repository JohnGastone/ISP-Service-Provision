import { getMyProfile } from "@/lib/api";
import { safeLoad } from "@/lib/safe";
import { formatTzPhone } from "@/lib/tz";
import { Card, CardHeader, ErrorNotice, PageHeading } from "@/components/ui";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "My details" };

export default async function ProfilePage() {
  const { data: customer, error } = await safeLoad<Customer | null>(getMyProfile, null);

  return (
    <>
      <PageHeading
        title="My details"
        subtitle="Registered by the ISP. Contact support to change these details."
      />

      {error ? (
        <div className="mb-6">
          <ErrorNotice message={error} />
        </div>
      ) : null}

      <div className="max-w-2xl">
        <Card>
          <CardHeader title="Account" />
          {customer ? (
            <dl className="divide-y divide-slate-100">
              <Row label="Full name" value={customer.name} />
              <Row label="Email address" value={customer.email} />
              <Row label="Phone number" value={formatTzPhone(customer.phone)} />
              <Row label="District" value={customer.district} />
              <Row label="Region" value={customer.region} />
              <Row label="Customer ID" value={`#${customer.id}`} />
            </dl>
          ) : (
            <p className="px-6 py-12 text-center text-sm text-slate-500">
              Your details could not be loaded.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-6 py-4 sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 sm:col-span-2">{value}</dd>
    </div>
  );
}
