import { createMiddleware } from "@tanstack/react-start";

export const attachWamAuth = createMiddleware({ type: "function" }).client(async ({ next }) => {
  const config = (await fetch("/api/wam/config").then((response) => response.json())) as {
    localDemo: boolean;
  };
  if (config.localDemo) return next();
  const { supabase } = await import("../../integrations/supabase/client");
  const { data } = await supabase.auth.getSession();
  return next({
    headers: data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {},
  });
});
