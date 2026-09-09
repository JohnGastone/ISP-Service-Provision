import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

const HIGHLIGHTS = [
  "Track your download and upload allocation",
  "Request more bandwidth in a few clicks",
  "Approvals checked against live pool capacity",
];

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel — decorative, hidden on small screens. */}
      <section className="auth-backdrop relative hidden flex-1 flex-col justify-between p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-xs font-extrabold backdrop-blur">
            ISP
          </span>
          <span className="text-base font-bold tracking-tight">Service Provision</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-4xl font-bold leading-[1.15] tracking-tight">
            Bandwidth provisioning,
            <br />
            <span className="text-accent-300">managed end to end.</span>
          </h2>
          <ul className="mt-8 space-y-3.5">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-white/80">
                <svg
                  className="mt-0.5 h-4 w-4 shrink-0 text-accent-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-white/50">
          © {new Date().getFullYear()} ISP Service Provision
        </p>
      </section>

      {/* Sign-in panel */}
      <section className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-12 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:hidden">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-extrabold text-white shadow-lift">
              ISP
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to manage your connection and bandwidth.
          </p>

          <div className="mt-7 rounded-2xl border border-slate-200/80 bg-white p-7 shadow-card">
            <Suspense fallback={<div className="h-64" />}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
            Accounts are created by the ISP administrator.
            <br />
            Contact support if you cannot sign in.
          </p>
        </div>
      </section>
    </main>
  );
}
