import Link from "next/link";
import CustomerForm from "@/components/CustomerForm";
import { PageHeading } from "@/components/ui";

export const metadata = { title: "Register customer" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeading
        title="Register customer"
        subtitle="Create the account, then share the sign-in details with the customer."
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
        <CustomerForm />
      </div>
    </>
  );
}
