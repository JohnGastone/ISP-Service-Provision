import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

let mockPathname = "/admin";

import {
  EmptyState,
  ErrorNotice,
  StatCard,
  StatusBadge,
  UsageBar,
  cn,
} from "@/components/ui";
import { Button, Field, Input, Select } from "@/components/form";
import { NavLink } from "@/components/NavLink";

describe("cn", () => {
  it("joins truthy class names and drops the rest", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
});

describe("StatusBadge", () => {
  it.each([
    ["PENDING", "Pending"],
    ["APPROVED", "Approved"],
    ["REJECTED", "Rejected"],
  ] as const)("renders %s in sentence case", (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe("UsageBar", () => {
  it("exposes utilisation to assistive technology", () => {
    render(<UsageBar label="Download" usedPct={73.5} />);
    const bar = screen.getByRole("progressbar", { name: /download utilisation/i });

    expect(bar).toHaveAttribute("aria-valuenow", "74");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(screen.getByText("73.5% used")).toBeInTheDocument();
  });

  it("clamps values outside 0–100", () => {
    const { rerender } = render(<UsageBar label="Upload" usedPct={140} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "100");

    rerender(<UsageBar label="Upload" usedPct={-20} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  });

  it("renders an optional caption", () => {
    render(<UsageBar label="Download" usedPct={50} caption="100 Mbps remaining" />);
    expect(screen.getByText("100 Mbps remaining")).toBeInTheDocument();
  });
});

describe("StatCard", () => {
  it("renders label, value and hint", () => {
    render(<StatCard label="Customers" value={12} hint="Registered accounts" />);
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("Registered accounts")).toBeInTheDocument();
  });
});

describe("ErrorNotice", () => {
  it("announces itself as an alert", () => {
    render(<ErrorNotice message="Cannot reach the API service" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot reach the api service/i);
  });
});

describe("EmptyState", () => {
  it("renders the title, description and action", () => {
    render(
      <EmptyState title="Nothing pending" description="All done" action={<button>Add</button>} />,
    );
    expect(screen.getByText("Nothing pending")).toBeInTheDocument();
    expect(screen.getByText("All done")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });
});

describe("Field and controls", () => {
  it("associates the label with its control", () => {
    render(
      <Field label="Download (Mbps)" htmlFor="dl">
        <Input id="dl" />
      </Field>,
    );
    expect(screen.getByLabelText(/download \(mbps\)/i)).toBeInTheDocument();
  });

  it("shows the error instead of the hint, and links it for screen readers", () => {
    render(
      <Field label="Phone" htmlFor="phone" hint="Tanzanian mobile" error="Invalid number">
        <Input id="phone" invalid />
      </Field>,
    );

    expect(screen.getByText("Invalid number")).toBeInTheDocument();
    expect(screen.queryByText("Tanzanian mobile")).toBeNull();

    const input = screen.getByLabelText("Phone");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "phone-error");
  });

  it("shows the hint when there is no error", () => {
    render(
      <Field label="Phone" htmlFor="phone" hint="Tanzanian mobile">
        <Input id="phone" />
      </Field>,
    );
    expect(screen.getByText("Tanzanian mobile")).toBeInTheDocument();
  });

  it("marks an invalid select for assistive technology", () => {
    render(
      <Field label="Region" htmlFor="region" error="Region is required">
        <Select id="region" invalid>
          <option value="">Pick</option>
        </Select>
      </Field>,
    );
    expect(screen.getByLabelText("Region")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Button", () => {
  it("is disabled and shows a spinner while loading", () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole("button", { name: /save/i });
    expect(button).toBeDisabled();
    expect(button.querySelector("svg")).toBeTruthy();
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button disabled onClick={onClick}>
        Approve
      </Button>,
    );
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("fires onClick when enabled", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={onClick}>Approve</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("NavLink", () => {
  it("marks the current page for exact matches only", () => {
    mockPathname = "/admin";
    const { rerender } = render(
      <NavLink item={{ href: "/admin", label: "Dashboard", exact: true }} />,
    );
    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");

    mockPathname = "/admin/customers";
    rerender(<NavLink item={{ href: "/admin", label: "Dashboard", exact: true }} />);
    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current");
  });

  it("marks a section as current for prefix matches", () => {
    mockPathname = "/admin/customers/new";
    render(<NavLink item={{ href: "/admin/customers", label: "Customers" }} />);
    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page");
  });
});
