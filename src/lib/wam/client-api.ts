async function authHeaders(): Promise<Record<string, string>> {
  let authorization: string | undefined;
  const local = (await fetch("/api/wam/config").then((response) => response.json())) as {
    localDemo: boolean;
  };
  if (!local.localDemo) {
    const { supabase } = await import("../../integrations/supabase/client");
    const { data: session } = await supabase.auth.getSession();
    if (session.session) authorization = `Bearer ${session.session.access_token}`;
  }
  return authorization ? { Authorization: authorization } : {};
}

export async function wamPhoto(path: string): Promise<Blob> {
  const response = await fetch(path, { credentials: "same-origin", headers: await authHeaders() });
  if (!response.ok) throw new Error("Could not load this photo.");
  return response.blob();
}

export async function wamRequest<T>(path: string, data?: unknown, method = "POST"): Promise<T> {
  const response = await fetch(`/api/wam/${path}`, {
    method: data === undefined ? "GET" : method,
    credentials: "same-origin",
    headers: {
      ...(data === undefined ? {} : { "Content-Type": "application/json" }),
      ...(await authHeaders()),
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const payload = await response.json();
  if (!response.ok)
    throw Object.assign(new Error(payload.error ?? "Request failed."), { status: response.status });
  return payload as T;
}
