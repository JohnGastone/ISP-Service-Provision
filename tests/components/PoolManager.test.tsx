import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/client-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client-api")>()),
  api,
}));

import { CreatePool, PoolTotalsForm } from "@/app/admin/bandwidth/PoolManager";
import { ClientApiError } from "@/lib/client-api";
import type { BandwidthPool } from "@/lib/types";

const pool: BandwidthPool = {
  id: 1,
  totalUploadMbps: 1000,
  totalDownloadMbps: 1000,
  uploadAllocatedMbps: 900,
  downloadAllocatedMbps: 900,
  uploadRemainingMbps: 100,
  downloadRemainingMbps: 100,
};

beforeEach(() => {
  refresh.mockReset();
  api.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("CreatePool", () => {
  it("posts both totals to the pools endpoint", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 2 });

    render(<CreatePool />);
    await user.type(screen.getByLabelText(/total download/i), "1000");
    await user.type(screen.getByLabelText(/total upload/i), "500");
    await user.click(screen.getByRole("button", { name: /create pool/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/bandwidth/pools", {
        method: "POST",
        body: { totalDownloadMbps: 1000, totalUploadMbps: 500 },
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("requires both totals", async () => {
    const user = userEvent.setup();
    render(<CreatePool />);

    await user.click(screen.getByRole("button", { name: /create pool/i }));

    expect(await screen.findByText(/total download is required/i)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("rejects negative totals", async () => {
    const user = userEvent.setup();
    render(<CreatePool />);

    await user.type(screen.getByLabelText(/total download/i), "-5");
    await user.type(screen.getByLabelText(/total upload/i), "100");
    await user.click(screen.getByRole("button", { name: /create pool/i }));

    expect(await screen.findByText(/cannot be negative/i)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("clears the form after a successful create", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 2 });

    render(<CreatePool />);
    await user.type(screen.getByLabelText(/total download/i), "1000");
    await user.type(screen.getByLabelText(/total upload/i), "500");
    await user.click(screen.getByRole("button", { name: /create pool/i }));

    await waitFor(() => expect(screen.getByLabelText(/total download/i)).toHaveValue(null));
  });

  it("shows a server error", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(new ClientApiError("Bad Request", 400));

    render(<CreatePool />);
    await user.type(screen.getByLabelText(/total download/i), "1000");
    await user.type(screen.getByLabelText(/total upload/i), "500");
    await user.click(screen.getByRole("button", { name: /create pool/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/bad request/i);
  });
});

describe("PoolTotalsForm", () => {
  const onCancel = vi.fn();

  it("prefills the pool's current totals", () => {
    render(<PoolTotalsForm pool={pool} onCancel={onCancel} />);

    expect(screen.getByLabelText(/total download/i)).toHaveValue(1000);
    expect(screen.getByLabelText(/total upload/i)).toHaveValue(1000);
  });

  it("puts the new totals to the pool", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 1 });

    render(<PoolTotalsForm pool={pool} onCancel={onCancel} />);

    const download = screen.getByLabelText(/total download/i);
    await user.clear(download);
    await user.type(download, "2000");
    await user.click(screen.getByRole("button", { name: /save totals/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/bandwidth/pools/1", {
        method: "PUT",
        body: { totalDownloadMbps: 2000, totalUploadMbps: 1000 },
      }),
    );
  });

  /** Mirrors the backend's 422 rule before the request is sent. */
  it("blocks a total below what is already allocated", async () => {
    const user = userEvent.setup();

    render(<PoolTotalsForm pool={pool} onCancel={onCancel} />);

    const download = screen.getByLabelText(/total download/i);
    await user.clear(download);
    await user.type(download, "500"); // below the 900 already allocated
    await user.click(screen.getByRole("button", { name: /save totals/i }));

    expect(await screen.findByText(/cannot go below 900 Mbps already allocated/i)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("surfaces the backend's 422 if it rejects anyway", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(new ClientApiError("New total is below allocated 900/900 Mbps", 422));

    render(<PoolTotalsForm pool={pool} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: /save totals/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/below allocated/i);
  });

  it("restores the original totals on cancel", async () => {
    const user = userEvent.setup();

    render(<PoolTotalsForm pool={pool} onCancel={onCancel} />);

    const download = screen.getByLabelText(/total download/i);
    await user.clear(download);
    await user.type(download, "5");
    await user.click(screen.getByRole("button", { name: /^cancel$/i }));

        expect(screen.getByLabelText(/total download/i)).toHaveValue(1000);
  });

  it("shows what is allocated and free as guidance", async () => {
    const user = userEvent.setup();
    render(<PoolTotalsForm pool={pool} onCancel={onCancel} />);

    expect(screen.getAllByText(/900 Mbps allocated · 100 Mbps free/i).length).toBeGreaterThan(0);
  });
});
