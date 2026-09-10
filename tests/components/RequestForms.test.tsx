import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/client-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client-api")>()),
  api,
}));

import AdminRequestForm from "@/app/admin/requests/NewRequestForm";
import MyRequestForm from "@/app/customer/requests/MyRequestForm";
import { ClientApiError } from "@/lib/client-api";
import type { BandwidthPool, Customer } from "@/lib/types";

const pools: BandwidthPool[] = [
  {
    id: 1,
    totalUploadMbps: 1000,
    totalDownloadMbps: 1000,
    uploadAllocatedMbps: 900,
    downloadAllocatedMbps: 900,
    uploadRemainingMbps: 100,
    downloadRemainingMbps: 100,
  },
  {
    id: 2,
    totalUploadMbps: 500,
    totalDownloadMbps: 500,
    uploadAllocatedMbps: 0,
    downloadAllocatedMbps: 0,
    uploadRemainingMbps: 500,
    downloadRemainingMbps: 500,
  },
];

const customers: Customer[] = [
  {
    id: 1,
    name: "Acme Corp",
    email: "ops@acme.co.tz",
    phone: "+255712345678",
    district: "Kinondoni",
    region: "Dar es Salaam",
  },
];

beforeEach(() => {
  refresh.mockReset();
  api.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("Admin NewRequestForm", () => {
  it("posts a request on behalf of the chosen customer", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 100 });

    render(<AdminRequestForm customers={customers} pools={pools} />);
    await user.selectOptions(screen.getByLabelText(/customer/i), "1");
    await user.selectOptions(screen.getByLabelText(/bandwidth pool/i), "2");
    await user.type(screen.getByLabelText(/download/i), "400");
    await user.type(screen.getByLabelText(/upload/i), "300");
    await user.click(screen.getByRole("button", { name: /create request/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/bandwidth/requests", {
        method: "POST",
        body: {
          customerId: 1,
          poolId: 2,
          requestedDownloadMbps: 400,
          requestedUploadMbps: 300,
        },
      }),
    );
  });

  it("lists each pool with its free capacity", () => {
    render(<AdminRequestForm customers={customers} pools={pools} />);
    const select = screen.getByLabelText(/bandwidth pool/i);

    expect(within(select).getByRole("option", { name: /Pool #1 — 100 Mbps/ })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: /Pool #2 — 500 Mbps/ })).toBeInTheDocument();
  });

  it("warns when the request exceeds the selected pool's capacity", async () => {
    const user = userEvent.setup();
    render(<AdminRequestForm customers={customers} pools={pools} />);

    await user.selectOptions(screen.getByLabelText(/bandwidth pool/i), "1");
    await user.type(screen.getByLabelText(/download/i), "500");
    await user.type(screen.getByLabelText(/upload/i), "400");

    expect(await screen.findByText(/exceeds the pool's remaining capacity/i)).toBeInTheDocument();
  });

  it("confirms when the pool can cover the request", async () => {
    const user = userEvent.setup();
    render(<AdminRequestForm customers={customers} pools={pools} />);

    await user.selectOptions(screen.getByLabelText(/bandwidth pool/i), "2");
    await user.type(screen.getByLabelText(/download/i), "100");
    await user.type(screen.getByLabelText(/upload/i), "100");

    expect(await screen.findByText(/should approve cleanly/i)).toBeInTheDocument();
  });

  it("requires a customer and a pool", async () => {
    const user = userEvent.setup();
    render(<AdminRequestForm customers={customers} pools={pools} />);

    await user.type(screen.getByLabelText(/download/i), "10");
    await user.type(screen.getByLabelText(/upload/i), "10");
    await user.click(screen.getByRole("button", { name: /create request/i }));

    // The placeholder option shares this text, so assert on the error element.
    expect(await screen.findByText(/select a customer/i, { selector: "p" })).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("disables submission when there are no customers or pools", () => {
    render(<AdminRequestForm customers={[]} pools={[]} />);
    expect(screen.getByRole("button", { name: /create request/i })).toBeDisabled();
    expect(screen.getByLabelText(/customer/i)).toBeDisabled();
  });

  it("surfaces a server error", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(new ClientApiError("Pool not found", 404));

    render(<AdminRequestForm customers={customers} pools={pools} />);
    await user.selectOptions(screen.getByLabelText(/customer/i), "1");
    await user.selectOptions(screen.getByLabelText(/bandwidth pool/i), "1");
    await user.type(screen.getByLabelText(/download/i), "10");
    await user.type(screen.getByLabelText(/upload/i), "10");
    await user.click(screen.getByRole("button", { name: /create request/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/pool not found/i);
  });
});

describe("Customer MyRequestForm", () => {
  it("offers pools as a dropdown rather than a manual id field", () => {
    render(<MyRequestForm pools={pools} hasPending={false} />);

    const poolField = screen.getByLabelText(/service pool/i);
    expect(poolField.tagName).toBe("SELECT");
    expect(within(poolField).getByRole("option", { name: /Pool #1/ })).toBeInTheDocument();
    expect(within(poolField).getByRole("option", { name: /Pool #2/ })).toBeInTheDocument();
  });

  it("shows each pool's free capacity to guide the choice", () => {
    render(<MyRequestForm pools={pools} hasPending={false} />);
    const poolField = screen.getByLabelText(/service pool/i);

    expect(within(poolField).getByRole("option", { name: /Pool #2 — 500 Mbps ↓ \/ 500 Mbps ↑ free/ }))
      .toBeInTheDocument();
  });

  it("preselects the only pool when there is just one", () => {
    render(<MyRequestForm pools={[pools[0]]} hasPending={false} />);
    expect(screen.getByLabelText(/service pool/i)).toHaveValue("1");
  });

  it("omits customerId — the API forces the authenticated customer's own id", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 101 });

    render(<MyRequestForm pools={pools} hasPending={false} />);
    await user.selectOptions(screen.getByLabelText(/service pool/i), "2");
    await user.type(screen.getByLabelText(/download/i), "50");
    await user.type(screen.getByLabelText(/upload/i), "20");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/bandwidth/requests", {
        method: "POST",
        body: { poolId: 2, requestedDownloadMbps: 50, requestedUploadMbps: 20 },
      }),
    );
    expect(JSON.stringify(api.mock.calls[0][1].body)).not.toContain("customerId");
  });

  it("disables the form when no pools are available", () => {
    render(<MyRequestForm pools={[]} hasPending={false} />);

    expect(screen.getByLabelText(/service pool/i)).toBeDisabled();
    expect(screen.getByRole("button", { name: /submit request/i })).toBeDisabled();
    expect(screen.getByText(/no bandwidth pools to request from yet/i)).toBeInTheDocument();
  });

  it("falls back to configured pool ids when the API withholds the pool list", () => {
    render(<MyRequestForm pools={[]} fallbackPoolIds={[1, 2, 3]} hasPending={false} />);

    const poolField = screen.getByLabelText(/service pool/i);
    expect(poolField).toBeEnabled();
    expect(within(poolField).getByRole("option", { name: "Pool #1" })).toBeInTheDocument();
    expect(within(poolField).getByRole("option", { name: "Pool #3" })).toBeInTheDocument();
    // No capacity is claimed for pools we could not read.
    expect(within(poolField).queryByRole("option", { name: /free/ })).toBeNull();
  });

  it("submits a fallback pool id like any other", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 102 });

    render(<MyRequestForm pools={[]} fallbackPoolIds={[1, 2]} hasPending={false} />);
    await user.selectOptions(screen.getByLabelText(/service pool/i), "2");
    await user.type(screen.getByLabelText(/download/i), "30");
    await user.type(screen.getByLabelText(/upload/i), "10");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/bandwidth/requests", {
        method: "POST",
        body: { poolId: 2, requestedDownloadMbps: 30, requestedUploadMbps: 10 },
      }),
    );
  });

  it("warns when a request is already pending", () => {
    render(<MyRequestForm pools={pools} hasPending={true} />);
    expect(screen.getByText(/already have a request awaiting a decision/i)).toBeInTheDocument();
  });

  it("previews whether the chosen pool can cover the request", async () => {
    const user = userEvent.setup();
    render(<MyRequestForm pools={pools} hasPending={false} />);

    await user.selectOptions(screen.getByLabelText(/service pool/i), "1");
    await user.type(screen.getByLabelText(/download/i), "500");
    await user.type(screen.getByLabelText(/upload/i), "400");

    expect(await screen.findByText(/exceeds the pool's free capacity/i)).toBeInTheDocument();
  });

  it("confirms success and clears the figures", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 101 });

    render(<MyRequestForm pools={pools} hasPending={false} />);
    await user.selectOptions(screen.getByLabelText(/service pool/i), "2");
    await user.type(screen.getByLabelText(/download/i), "50");
    await user.type(screen.getByLabelText(/upload/i), "20");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(/request submitted/i);
    expect(screen.getByLabelText(/download/i)).toHaveValue(null);
  });

  it("validates before sending", async () => {
    const user = userEvent.setup();
    render(<MyRequestForm pools={pools} hasPending={false} />);

    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(
      await screen.findByText(/select a bandwidth pool/i, { selector: "p" }),
    ).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("surfaces a 403 if the API refuses", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(new ClientApiError("Admin role required", 403));

    render(<MyRequestForm pools={pools} hasPending={false} />);
    await user.selectOptions(screen.getByLabelText(/service pool/i), "1");
    await user.type(screen.getByLabelText(/download/i), "10");
    await user.type(screen.getByLabelText(/upload/i), "10");
    await user.click(screen.getByRole("button", { name: /submit request/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/admin role required/i);
  });
});
