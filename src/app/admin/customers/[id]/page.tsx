import Link from "next/link";
import { notFound } from "next/navigation";
import CustomerForm from "@/components/CustomerForm";
import { ApiRequestError, getCustomer } from "@/lib/api";
import { ErrorNotice, PageHeading } from "@/components/ui";
import type { Customer } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let customer: Customer;
  try {
    customer = await getCustomer(id);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) notFound();
    return (
      <>
        <PageHeading title="Edit customer" />
        <ErrorNotice
          message={
            error instanceof ApiRequestError
              ? error.message
              : "Could not load this customer. Check that the Spring Boot backend is running."
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeading
        title={customer.name}
        subtitle="Update contact details or the service address."
        action={
          <Link
            href="/admin/customers"
            className="text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back to customers
          </Link>
        }
      />
      <div className="max-w-3xl">
        <CustomerForm customer={customer} />
      </div>
    </>
  );
}
