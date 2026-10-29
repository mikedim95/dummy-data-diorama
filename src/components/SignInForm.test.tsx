import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SignInForm } from "./SignInForm";
import { setLanguage } from "@/lib/i18n";
const api = vi.hoisted(() => vi.fn());
vi.mock("@/lib/wam/client-api", () => ({ wamRequest: api }));
afterEach(() => {
  cleanup();
  setLanguage("el");
  api.mockReset();
});
it("renders one email/password form without a manager, provider or role choice", async () => {
  setLanguage("en");
  api.mockRejectedValue(Object.assign(new Error("Sign in to continue."), { status: 401 }));
  render(<SignInForm />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Sign in" })).not.toBeDisabled());
  expect((screen.getByLabelText("Email") as HTMLInputElement).type).toBe("email");
  expect((screen.getByLabelText("Password") as HTMLInputElement).type).toBe("password");
  expect(screen.getAllByRole("button")).toHaveLength(1);
  expect(screen.queryByRole("link")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByText(/manager|google|operator id|PIN|create account/i)).toBeNull();
});
it("submits only email and password to the common backend and displays its failure", async () => {
  setLanguage("en");
  api.mockImplementation((path: string) =>
    Promise.reject(
      Object.assign(
        new Error(
          path === "session" ? "Sign in to continue." : "Email or password not recognised.",
        ),
        { status: 401 },
      ),
    ),
  );
  render(<SignInForm />);
  const button = screen.getByRole("button", { name: "Sign in" });
  await waitFor(() => expect(button).not.toBeDisabled());
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nikos@wam.example" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "entered-password" } });
  fireEvent.click(button);
  await waitFor(() =>
    expect(screen.getByRole("alert").textContent).toBe("Email or password not recognised."),
  );
  expect(api).toHaveBeenCalledWith("login", {
    email: "nikos@wam.example",
    password: "entered-password",
  });
});
