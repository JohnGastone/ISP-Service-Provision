import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { push, back, refresh, api } = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
  api: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back, refresh }) }));

vi.mock("@/lib/client-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/client-api")>()),
  api,
}));

import CustomerForm from "@/components/CustomerForm";
import { ClientApiError } from "@/lib/client-api";

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/full name/i), "Acme Corp");
  await user.type(screen.getByLabelText(/email address/i), "ops@acme.co.tz");
  await user.type(screen.getByLabelText(/phone number/i), "0712345678");
  await user.selectOptions(screen.getByLabelText(/region/i), "Dar es Salaam");
  await user.selectOptions(screen.getByLabelText(/district/i), "Kinondoni");
}

beforeEach(() => {
  push.mockReset();
  back.mockReset();
  refresh.mockReset();
  api.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("CustomerForm — registration", () => {
  it("posts the nested location shape with an E.164 phone number", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 3, name: "Acme Corp", email: "ops@acme.co.tz" });

    render(<CustomerForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /register customer/i }));

    await waitFor(() =>
      expect(api).toHaveBeenCalledWith("/api/customers", {
        method: "POST",
        body: {
          name: "Acme Corp",
          email: "ops@acme.co.tz",
          phone: "+255712345678",
          location: { region: "Dar es Salaam", district: "Kinondoni" },
        },
      }),
    );
  });

  it("navigates to the list when no password was generated", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({ id: 3, name: "Acme Corp", email: "ops@acme.co.tz" });

    render(<CustomerForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /register customer/i }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(expect.stringContaining("/admin/customers")));
  });
});

describe("CustomerForm — validation", () => {
  it("rejects an invalid Tanzanian phone number before calling the API", async () => {
    const user = userEvent.setup();

    render(<CustomerForm />);
    await user.type(screen.getByLabelText(/full name/i), "Acme Corp");
    await user.type(screen.getByLabelText(/email address/i), "ops@acme.co.tz");
    await user.type(screen.getByLabelText(/phone number/i), "+254712345678");
    await user.selectOptions(screen.getByLabelText(/region/i), "Dar es Salaam");
    await user.selectOptions(screen.getByLabelText(/district/i), "Kinondoni");
    await user.click(screen.getByRole("button", { name: /register customer/i }));

    expect(await screen.findByText(/valid tanzanian mobile number/i)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("requires every field", async () => {
    const user = userEvent.setup();
    render(<CustomerForm />);

    await user.click(screen.getByRole("button", { name: /register customer/i }));

    expect(await screen.findByText(/name must be at least 3 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(api).not.toHaveBeenCalled();
  });

  it("shows the normalised number once the phone is valid", async () => {
    const user = userEvent.setup();
    render(<CustomerForm />);

    await user.type(screen.getByLabelText(/phone number/i), "0712345678");
    expect(await screen.findByText(/\+255712345678/)).toBeInTheDocument();
  });
});

describe("CustomerForm — cascading region and district", () => {
  it("disables the district selector until a region is chosen", () => {
    render(<CustomerForm />);
    expect(screen.getByLabelText(/district/i)).toBeDisabled();
  });

  it("offers only districts belonging to the chosen region", async () => {
    const user = userEvent.setup();
    render(<CustomerForm />);

    await user.selectOptions(screen.getByLabelText(/region/i), "Kilimanjaro");
    const district = screen.getByLabelText(/district/i);

    expect(within(district).getByRole("option", { name: "Moshi Municipal" })).toBeInTheDocument();
    expect(within(district).queryByRole("option", { name: "Kinondoni" })).toBeNull();
  });

  it("clears a chosen district when the region changes", async () => {
    const user = userEvent.setup();
    render(<CustomerForm />);

    await user.selectOptions(screen.getByLabelText(/region/i), "Dar es Salaam");
    await user.selectOptions(screen.getByLabelText(/district/i), "Kinondoni");
    expect(screen.getByLabelText(/district/i)).toHaveValue("Kinondoni");

    await user.selectOptions(screen.getByLabelText(/region/i), "Kilimanjaro");
    expect(screen.getByLabelText(/district/i)).toHaveValue("");
  });
});

describe("CustomerForm — one-time credential hand-off", () => {
  it("shows the generated password instead of navigating away", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({
      id: 3,
      name: "Acme Corp",
      email: "ops@acme.co.tz",
      generatedPassword: "Tz-ab12cd34",
    });

    render(<CustomerForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /register customer/i }));

    expect(await screen.findByText("Tz-ab12cd34")).toBeInTheDocument();
    expect(screen.getByText(/shown only once/i)).toBeInTheDocument();
    // Must not navigate away while the password is still on screen.
    expect(push).not.toHaveBeenCalled();
  });

  it("copies the credentials to the clipboard", async () => {
    const user = userEvent.setup();

    // userEvent.setup() installs its own clipboard stub, so override it after.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    api.mockResolvedValue({
      id: 3,
      name: "Acme Corp",
      email: "ops@acme.co.tz",
      generatedPassword: "Tz-ab12cd34",
    });

    render(<CustomerForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /register customer/i }));
    await user.click(await screen.findByRole("button", { name: /copy credentials/i }));

    expect(writeText).toHaveBeenCalledWith(
      "Email: ops@acme.co.tz\nPassword: Tz-ab12cd34",
    );
    expect(await screen.findByRole("button", { name: /copied/i })).toBeInTheDocument();
  });

  it("returns to a blank form via 'Register another'", async () => {
    const user = userEvent.setup();
    api.mockResolvedValue({
      id: 3,
      name: "Acme Corp",
      email: "ops@acme.co.tz",
      generatedPassword: "Tz-ab12cd34",
    });

    render(<CustomerForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /register customer/i }));
    await user.click(await screen.findByRole("button", { name: /register another/i }));

    expect(screen.getByLabelText(/full name/i)).toHaveValue("");
    expect(screen.queryByText("Tz-ab12cd34")).toBeNull();
  });
});

describe("CustomerForm — server errors", () => {
  it("flags a duplicate email on the email field", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(
      new ClientApiError("A customer with email ops@acme.co.tz already exists", 400),
    );

    render(<CustomerForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /register customer/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/already exists/i);
    expect(screen.getByText(/a customer with this email already exists/i)).toBeInTheDocument();
  });

  it("shows a generic message for other failures", async () => {
    const user = userEvent.setup();
    api.mockRejectedValue(new ClientApiError("Cannot reach the API service", 503));

    render(<CustomerForm />);
    await fillValidForm(user);
    await user.click(screen.getByRole("button", { name: /register customer/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/cannot reach the api service/i);
  });
});
