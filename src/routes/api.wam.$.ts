import { createFileRoute } from "@tanstack/react-router";

async function handle({ request }: { request: Request }) {
  const { handleWamRequest } = await import("../server/wam/api");
  return handleWamRequest(request);
}

export const Route = createFileRoute("/api/wam/$")({
  server: { handlers: { GET: handle, POST: handle, PATCH: handle } },
});
