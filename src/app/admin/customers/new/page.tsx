import Link from "next/link";
import CustomerForm from "@/components/CustomerForm";
import { PageHeading } from "@/components/ui";

export const metadata = { title: "Register customer" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeading
        title="Register customer"
        subtitle="The email must be unique; the phone number must be a Tanzanian mobile."
        action={
          <Link
            href="/admin/customers"
            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            ← Back to customers
          </Link>
        }
      />
      <div className="max-w-3xl">
        <CustomerForm />
      </div>
    </>
  );
}
