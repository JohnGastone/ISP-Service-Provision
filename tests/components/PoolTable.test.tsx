import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { refresh, api } = vi.hoisted(() => ({ refresh: vi.fn(), api: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/client-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client-api")>()),
  api,
}));

import PoolTable from "@/app/admin/bandwidth/PoolTable";
import type { BandwidthPool } from "@/lib/types";

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

beforeEach(() => {
  refresh.mockReset();
  api.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("PoolTable", () => {
  it("renders one row per pool in a table", () => {
    render(<PoolTable pools={pools} allocationsByPool={{ 1: 3 }} />);

    expect(screen.getByRole("table")).toBeInTheDocument();
    // Header row plus one row per pool.
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText("#1")).toBeInTheDocument();
    expect(screen.getByText("#2")).toBeInTheDocument();
  });

  it("shows free versus total capacity for both directions", () => {
    render(<PoolTable pools={[pools[0]]} allocationsByPool={{}} />);

    expect(screen.getAllByText("100 Mbps")).toHaveLength(2); // download and upload free
    expect(screen.getAllByText(/of 1 Gbps/)).toHaveLength(2);
  });

  it("exposes utilisation via progressbars", () => {
    render(<PoolTable pools={[pools[0]]} allocationsByPool={{}} />);

    const bars = screen.getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAttribute("aria-valuenow", "90");
  });

  it("shows the approved allocation count per pool", () => {
    render(<PoolTable pools={pools} allocationsByPool={{ 1: 3 }} />);

    const rows = screen.getAllByRole("row");
    expect(within(rows[1]).getByText("3")).toBeInTheDocument();
    expect(within(rows[2]).getByText("0")).toBeInTheDocument();
  });

  it("expands one pool's adjust form inline and collapses it again", async () => {
    const user = userEvent.setup();
    render(<PoolTable pools={pools} allocationsByPool={{}} />);

    expect(screen.queryByLabelText(/total download/i)).toBeNull();

    const [firstAdjust] = screen.getAllByRole("button", { name: "Adjust" });
    await user.click(firstAdjust);

    expect(screen.getByLabelText(/total download/i)).toHaveValue(1000);
    expect(screen.getByRole("button", { name: "Close" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByLabelText(/total download/i)).toBeNull();
  });

  it("keeps only one row expanded at a time", async () => {
    const user = userEvent.setup();
    render(<PoolTable pools={pools} allocationsByPool={{}} />);

    const adjustButtons = screen.getAllByRole("button", { name: "Adjust" });
    await user.click(adjustButtons[0]);
    await user.click(screen.getAllByRole("button", { name: "Adjust" })[0]);

    // The second pool's form replaced the first — one form on screen.
    expect(screen.getAllByLabelText(/total download/i)).toHaveLength(1);
  });

  it("renders an empty state with no pools", () => {
    render(<PoolTable pools={[]} allocationsByPool={{}} />);

    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText(/no pools created yet/i)).toBeInTheDocument();
  });
});
