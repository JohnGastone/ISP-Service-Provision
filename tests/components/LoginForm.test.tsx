import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { replace, refresh, local } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  local: vi.fn(),
}));

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/lib/client-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client-api")>()),
  local,
}));

import LoginForm from "@/app/login/LoginForm";
import { ClientApiError } from "@/lib/client-api";

beforeEach(() => {
  replace.mockReset();
  refresh.mockReset();
  local.mockReset();
  searchParams = new URLSearchParams();
});

afterEach(() => vi.restoreAllMocks());

describe("LoginForm", () => {
  it("signs an admin in and routes to the admin home", async () => {
    const user = userEvent.setup();
    local.mockResolvedValue({ user: { username: "admin", fullName: "admin", role: "ADMIN" } });

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email or username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "change-me");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() =>
      expect(local).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        body: { username: "admin", password: "change-me" },
      }),
    );
    expect(replace).toHaveBeenCalledWith("/admin");
  });

  it("routes a customer to the customer portal", async () => {
    const user = userEvent.setup();
    local.mockResolvedValue({
      user: { username: "ops@acme.co.tz", fullName: "ops@acme.co.tz", role: "CUSTOMER" },
    });

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email or username/i), "ops@acme.co.tz");
    await user.type(screen.getByLabelText(/password/i), "pw");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/customer"));
  });

  /**
   * Regression: password managers write straight into the DOM without firing
   * React's onChange, leaving controlled state empty. The form must submit what
   * the inputs actually hold, not what state happens to contain.
   */
  it("submits browser-autofilled values that never fired onChange", async () => {
    local.mockResolvedValue({ user: { username: "admin", fullName: "admin", role: "ADMIN" } });

    render(<LoginForm />);
    const username = screen.getByLabelText(/email or username/i) as HTMLInputElement;
    const password = screen.getByLabelText(/password/i) as HTMLInputElement;

    // Simulate autofill: set the DOM value directly, bypassing React's handler.
    const setValue = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    )!.set!;
    setValue.call(username, "admin");
    setValue.call(password, "change-me");

    fireEvent.submit(screen.getByRole("button", { name: /sign in/i }).closest("form")!);

    await waitFor(() =>
      expect(local).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        body: { username: "admin", password: "change-me" },
      }),
    );
  });

  it("blocks submission and shows field errors when both fields are empty", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/enter your email address or username/i)).toBeInTheDocument();
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    expect(local).not.toHaveBeenCalled();
  });

  it("shows the server's message when credentials are rejected", async () => {
    const user = userEvent.setup();
    local.mockRejectedValue(new ClientApiError("Incorrect username or password", 401));

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email or username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "wrong");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect username or password/i);
    expect(replace).not.toHaveBeenCalled();
  });

  it("surfaces an unreachable-backend message", async () => {
    const user = userEvent.setup();
    local.mockRejectedValue(
      new ClientApiError("Cannot reach the API service (No response from ...)", 503),
    );

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email or username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "x");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot reach the api service/i);
  });

  it("honours an internal ?next destination", async () => {
    const user = userEvent.setup();
    searchParams = new URLSearchParams("next=/admin/requests");
    local.mockResolvedValue({ user: { username: "admin", fullName: "admin", role: "ADMIN" } });

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email or username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "x");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin/requests"));
  });

  it.each(["https://evil.example.com", "//evil.example.com"])(
    "ignores the external redirect target %s",
    async (target) => {
      const user = userEvent.setup();
      searchParams = new URLSearchParams(`next=${target}`);
      local.mockResolvedValue({ user: { username: "admin", fullName: "admin", role: "ADMIN" } });

      render(<LoginForm />);
      await user.type(screen.getByLabelText(/email or username/i), "admin");
      await user.type(screen.getByLabelText(/password/i), "x");
      await user.click(screen.getByRole("button", { name: /sign in/i }));

      await waitFor(() => expect(replace).toHaveBeenCalledWith("/admin"));
    },
  );

  it("disables the button while the request is in flight", async () => {
    const user = userEvent.setup();
    let resolve!: (v: unknown) => void;
    local.mockReturnValue(new Promise((r) => (resolve = r)));

    render(<LoginForm />);
    await user.type(screen.getByLabelText(/email or username/i), "admin");
    await user.type(screen.getByLabelText(/password/i), "x");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("button")).toBeDisabled();
    resolve({ user: { username: "admin", fullName: "admin", role: "ADMIN" } });
  });
});
