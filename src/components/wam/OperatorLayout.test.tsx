import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { setLanguage } from "@/lib/i18n";
import { BottomNavigation } from "./OperatorLayout";
import type { ReactNode } from "react";
const state = vi.hoisted(() => ({ machine: null as { code: string } | null }));
vi.mock("@/lib/wam/store", () => ({ useWam: () => state }));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: () => "/scan",
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
afterEach(() => {
  cleanup();
  state.machine = null;
  setLanguage("el");
});
it("orders Profile, Scan, Work and keeps Work disabled until a machine is scanned", () => {
  setLanguage("el");
  const view = render(<BottomNavigation />);
  expect(screen.queryByRole("link", { name: "Εργασίες" })).toBeNull();
  expect(screen.getByRole("button", { name: "Εργασίες" })).toBeDisabled();
  expect(
    [...screen.getByRole("navigation").querySelectorAll("a,button")].map(
      (item) => item.textContent,
    ),
  ).toEqual(["Προφίλ", "Σάρωση", "Εργασίες"]);
  expect(screen.getByRole("link", { name: "Σάρωση" })).toBeTruthy();
  state.machine = { code: "WAM-CNC-01" };
  view.rerender(<BottomNavigation />);
  expect(screen.getByRole("link", { name: "Εργασίες" }).getAttribute("href")).toBe("/work");
  expect(screen.queryByRole("button", { name: "Εργασίες" })).toBeNull();
});
