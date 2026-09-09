"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { local } from "@/lib/client-api";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await local("/api/auth/logout", { method: "POST" });
    } catch {
      /* the cookie clear is what matters; fall through to the redirect */
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-60"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
