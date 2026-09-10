import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { replace, refresh, local } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  local: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  usePathname: () => "/admin",
}));

vi.mock("@/lib/client-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client-api")>()),
  local,
}));

import LogoutButton from "@/components/LogoutButton";
import AppShell from "@/components/AppShell";
import { safeLoad } from "@/lib/safe";
import { ApiRequestError } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

const admin: AuthUser = { username: "admin", fullName: "Neema Admin", role: "ADMIN" };

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  local.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("LogoutButton", () => {
  it("clears the session and returns to the login page", async () => {
    const user = userEvent.setup();
    local.mockResolvedValue({ ok: true });

    render(<LogoutButton />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(local).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" }));
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("still redirects when the logout call fails", async () => {
    const user = userEvent.setup();
    local.mockRejectedValue(new Error("network"));

    render(<LogoutButton />);
    await user.click(screen.getByRole("button", { name: /sign out/i }));

    // The cookie clear is what matters; the user must not be stranded.
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
  });
});

describe("AppShell", () => {
  const nav = [
    { href: "/admin", label: "Dashboard", exact: true },
    { href: "/admin/customers", label: "Customers" },
  ];

  it("shows the signed-in user, their role and initials", () => {
    render(
      <AppShell user={admin} nav={nav}>
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getByText("Neema Admin")).toBeInTheDocument();
    expect(screen.getByText("Administrator")).toBeInTheDocument();
    expect(screen.getByText("NA")).toBeInTheDocument();
  });

  it("labels a customer correctly", () => {
    render(
      <AppShell user={{ ...admin, role: "CUSTOMER", fullName: "Acme Corp" }} nav={nav}>
        <p>content</p>
      </AppShell>,
    );
    expect(screen.getByText("Customer")).toBeInTheDocument();
  });

  it("renders the navigation and children", () => {
    render(
      <AppShell user={admin} nav={nav}>
        <p>page content</p>
      </AppShell>,
    );

    // Sidebar and mobile nav both render the items.
    expect(screen.getAllByRole("link", { name: "Customers" }).length).toBeGreaterThan(0);
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});

describe("safeLoad", () => {
  it("returns data and no error on success", async () => {
    const result = await safeLoad(async () => [1, 2, 3], []);
    expect(result).toEqual({ data: [1, 2, 3], error: null });
  });

  it("degrades to the fallback and reports an API error message", async () => {
    const result = await safeLoad(async () => {
      throw new ApiRequestError("Admin role required", 403);
    }, [] as number[]);

    expect(result.data).toEqual([]);
    expect(result.error).toBe("Admin role required");
  });

  it("reports a connectivity hint for non-API failures", async () => {
    const result = await safeLoad(async () => {
      throw new TypeError("fetch failed");
    }, null);

    expect(result.data).toBeNull();
    expect(result.error).toMatch(/could not reach the api service/i);
  });
});
