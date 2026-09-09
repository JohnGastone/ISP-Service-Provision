import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in · ISP Service Provision" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            ISP
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-900">
            Service Provision Portal
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage your connection and bandwidth.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense fallback={<div className="h-64" />}>
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Accounts are created by the ISP administrator. Contact support if you cannot sign in.
        </p>
      </div>
    </main>
  );
}
