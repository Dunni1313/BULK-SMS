// Phase 6, Sprint 71 — Frontend Legacy Page Test Coverage, Slice 1.
// Login.tsx is already indirectly exercised by the Phase 6 Playwright E2E
// specs (every one signs up through it), but had no dedicated Vitest unit
// test — a different, faster, more granular bar. Follows App.test.tsx's own
// established auth-client mocking pattern (Sprint 53): useSession/signIn/
// signUp stubbed via vi.mock, actual re-exported for anything else.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithClient } from "@/test/test-utils";
import { Toaster } from "@/components/ui/toaster";

const signInMock = vi.hoisted(() => ({ email: vi.fn() }));
const signUpMock = vi.hoisted(() => ({ email: vi.fn() }));
const navigateMock = vi.hoisted(() => vi.fn());
const mockState = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("@/lib/auth-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth-client")>("@/lib/auth-client");
  return {
    ...actual,
    useSession: () => ({ data: mockState.session }),
    signIn: signInMock,
    signUp: signUpMock,
  };
});

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/login", navigateMock],
  };
});

import Login from "./Login";

describe("Login page", () => {
  beforeEach(() => {
    mockState.session = null;
    signInMock.email.mockReset().mockResolvedValue({ error: null });
    signUpMock.email.mockReset().mockResolvedValue({ error: null });
    navigateMock.mockReset();
  });

  it("shows the sign-in form by default", () => {
    renderWithClient(<Login />);
    expect(screen.getByText("Sign in to your account.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("toggles to the sign-up form, revealing the Name field", async () => {
    renderWithClient(<Login />);
    await userEvent.click(screen.getByRole("button", { name: /need an account\? sign up/i }));
    expect(screen.getByText("Create an account")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeInTheDocument();
  });

  it("submits sign-in with the entered credentials and navigates home on success", async () => {
    renderWithClient(<Login />);
    await userEvent.type(screen.getByLabelText("Email"), "trader@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInMock.email).toHaveBeenCalledWith({ email: "trader@example.test", password: "hunter2hunter2" });
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("submits sign-up with name, email, and password once toggled", async () => {
    renderWithClient(<Login />);
    await userEvent.click(screen.getByRole("button", { name: /need an account\? sign up/i }));
    await userEvent.type(screen.getByLabelText("Name"), "New Trader");
    await userEvent.type(screen.getByLabelText("Email"), "new@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(signUpMock.email).toHaveBeenCalledWith({
      email: "new@example.test",
      password: "hunter2hunter2",
      name: "New Trader",
    });
    expect(navigateMock).toHaveBeenCalledWith("/");
  });

  it("shows an honest error toast and does not navigate when authentication fails", async () => {
    signInMock.email.mockResolvedValue({ error: { message: "Invalid email or password" } });
    renderWithClient(
      <>
        <Login />
        <Toaster />
      </>,
    );
    await userEvent.type(screen.getByLabelText("Email"), "trader@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrongpassword");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Authentication failed")).toBeInTheDocument();
    expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("shows an already-signed-in state instead of the form when a session exists", () => {
    mockState.session = { user: { email: "trader@example.test" } };
    renderWithClient(<Login />);
    expect(screen.getByText("Already signed in")).toBeInTheDocument();
    expect(screen.getByText(/Signed in as trader@example\.test/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
  });
});
