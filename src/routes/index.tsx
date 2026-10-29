import { createFileRoute } from "@tanstack/react-router";
import { SignInForm } from "@/components/SignInForm";
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in · WAM" },
      { name: "description", content: "Sign in to WAM with your email and password." },
    ],
  }),
  component: SignInForm,
});
