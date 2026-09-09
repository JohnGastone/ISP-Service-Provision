import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/client-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client-api")>()),
  api,
}));

import RequestRow from "@/app/admin/requests/RequestRow";
import { ClientApiError } from "@/lib/client-api";
import type { BandwidthPool, BandwidthRequest, Customer } from "@/lib/types";

const pool: BandwidthPool = {
  id: 1,
  totalUploadMbps: 1000,
  totalDownloadMbps: 1000,
  uploadAllocatedMbps: 900,
  downloadAllocatedMbps: 900,
  uploadRemainingMbps: 100,
  downloadRemainingMbps: 100,
};

const customer: Customer = {
  id: 1,
  name: "Acme Corp",
  email: "ops@acme.co.tz",
  phone: "+255712345678",
  district: "Kinondoni",
  region: "Dar es Salaam",
};

function request(overrides: Partial<BandwidthRequest> = {}): BandwidthRequest {
  return {
    id: 10,
    customerId: 1,
    poolId: 1,
    requestedUploadMbps: 50,
    requestedDownloadMbps: 80,
    status: "PENDING",
    requestedAt: "2026-09-01T08:00:00Z",
    decidedAt: null,
    decisionNote: null,
    ...overrides,
  };
}

beforeEach(() => {
  refresh.mockReset();
  api.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("capacity verdict", () => {
  it("enables approval and previews the remainder when the request fits", () => {
    render(<RequestRow request={request()} pool={pool} customer={customer} />);

    expect(screen.getByText(/sufficient capacity/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeEnabled();

    // The banner previews what would remain: 100-80 = 20 down, 100-50 = 50 up.
    const banner = screen.getByText(/sufficient capacity/i).closest("p")!;
    expect(banner).toHaveTextContent(/20 Mbps/);
    expect(banner).toHaveTextContent(/50 Mbps/);
  });

  it("blocks approval and lists exact shortfalls when it does not fit", () => {
    render(
      <RequestRow
        request={request({ requestedUploadMbps: 400, requestedDownloadMbps: 500 })}
        pool={pool}
        customer={customer}
      />,
    );

    expect(screen.getByText(/insufficient capacity/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload short by 300 Mbps/)).toBeInTheDocument();
    expect(screen.getByText(/Download short by 400 Mbps/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
  });

  it("blocks approval when the pool could not be loaded", () => {
    render(<RequestRow request={request()} pool={null} customer={customer} />);

    expect(screen.getByText(/capacity cannot be verified/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeDisabled();
  });

  it("allows a request that exactly consumes the remaining capacity", () => {
    render(
      <RequestRow
        request={request({ requestedUploadMbps: 100, requestedDownloadMbps: 100 })}
        pool={pool}
        customer={customer}
      />,
    );
    expect(screen.getByRole("button", { name: /^approve$/i })).toBeEnabled();
  });
});

describe("approving", () => {
  it("posts to the approve endpoint with an optional note", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({});

    render(<RequestRow request={request()} pool={pool} customer={customer} />);
    await user.type(screen.getByLabelText(/decision note/i), "approved for Q3");
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/bandwidth/requests/10/approve", {
        method: "POST",
        body: { note: "approved for Q3" },
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("omits the note when none is given", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({});

    render(<RequestRow request={request()} pool={pool} customer={customer} />);
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/bandwidth/requests/10/approve", {
        method: "POST",
        body: {},
      }),
    );
  });

  it("surfaces the backend's 422 capacity detail", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(
      new ClientApiError(
        "Pool 1 cannot cover request 10: needs 400/500 Mbps (up/down), remaining 100/100 Mbps",
        422,
      ),
    );

    render(<RequestRow request={request()} pool={pool} customer={customer} />);
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot cover request 10/i);
  });

  it("surfaces a 409 when the request was already decided", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(new ClientApiError("Request 10 is already APPROVED", 409));

    render(<RequestRow request={request()} pool={pool} customer={customer} />);
    await user.click(screen.getByRole("button", { name: /^approve$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already APPROVED/i);
  });
});

describe("rejecting", () => {
  it("requires a reason before sending", async () => {
    const user = userEvent.setup();

    render(<RequestRow request={request()} pool={pool} customer={customer} />);
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.click(screen.getByRole("button", { name: /confirm rejection/i }));

    expect(await screen.findByText(/a reason is required/i)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("posts the reason to the reject endpoint", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({});

    render(<RequestRow request={request()} pool={pool} customer={customer} />);
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.type(screen.getByLabelText(/reason for rejection/i), "duplicate request");
    await user.click(screen.getByRole("button", { name: /confirm rejection/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/bandwidth/requests/10/reject", {
        method: "POST",
        body: { note: "duplicate request" },
      }),
    );
  });

  it("can reject a request that has insufficient capacity", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({});

    render(
      <RequestRow
        request={request({ requestedUploadMbps: 400, requestedDownloadMbps: 500 })}
        pool={pool}
        customer={customer}
      />,
    );

    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.type(screen.getByLabelText(/reason for rejection/i), "no capacity");
    await user.click(screen.getByRole("button", { name: /confirm rejection/i }));

    await waitFor(() => expect(api).toHaveBeenCalled());
  });

  it("can be cancelled", async () => {
    const user = userEvent.setup();

    render(<RequestRow request={request()} pool={pool} customer={customer} />);
    await user.click(screen.getByRole("button", { name: /^reject$/i }));
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

    expect(screen.getByRole("button", { name: /^reject$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /confirm rejection/i })).toBeNull();
  });
});

describe("decided requests", () => {
  it.each(["APPROVED", "REJECTED"] as const)(
    "shows the outcome for a %s request without decision controls",
    (status) => {
      render(
        <RequestRow
          request={request({
            status,
            decidedAt: "2026-09-03T10:00:00Z",
            decisionNote: "handled",
          })}
          pool={pool}
          customer={customer}
        />,
      );

      expect(screen.getByText(/handled/)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /^approve$/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /^reject$/i })).toBeNull();
    },
  );
});

describe("customer details", () => {
  it("shows the customer's contact details with a formatted phone number", () => {
    render(<RequestRow request={request()} pool={pool} customer={customer} />);
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/0712 345 678/)).toBeInTheDocument();
    expect(screen.getByText(/Kinondoni/)).toBeInTheDocument();
  });

  it("falls back to the id when the customer is unknown", () => {
    render(<RequestRow request={request()} pool={pool} customer={null} />);
    expect(screen.getByText(/Customer #1/)).toBeInTheDocument();
    expect(screen.getByText(/customer details unavailable/i)).toBeInTheDocument();
  });
});
