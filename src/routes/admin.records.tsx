import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PageHeader, Panel } from "@/components/admin/ui";
import { getManagementRecords } from "@/lib/wam/admin.functions";
import { wamRequest, wamPhoto } from "@/lib/wam/client-api";
import type { RecordEntity, RecordField } from "@/lib/wam/record-catalog";

type SearchState = {
  entity?: string | undefined;
  record?: string | undefined;
  q?: string | undefined;
  offset?: number | undefined;
};
const searchSchema = z.object({
  entity: z
    .string()
    .regex(/^[A-Z_]+$/)
    .optional(),
  record: z.string().uuid().optional(),
  q: z.string().max(200).optional(),
  offset: z.coerce.number().int().min(0).max(1000000).optional(),
});
export const Route = createFileRoute("/admin/records")({
  validateSearch: (search): SearchState => searchSchema.parse(search),
  head: () => ({ meta: [{ title: "Manage records · WAM" }] }),
  component: RecordsPage,
});
type RecordRow = Record<string, unknown>;
type Workspace = {
  entities: RecordEntity[];
  rows: RecordRow[];
  lookups: Record<string, { id: string; label: string }[]>;
  total: number;
  offset: number;
  pageSize: number;
  canSeeFinance: boolean;
};
const descriptions: Record<string, string> = {
  STOCK_BALANCE:
    "Balances are maintained by receipts, transfers, usage, returns and stock-count adjustments.",
  STOCK_MOVEMENT:
    "Post actual stock changes here. Posted quantities stay fixed; use a new movement to correct stock.",
  TEMPLATE: "Every upload creates an immutable design revision. Orders approve one exact revision.",
  JOB_MATERIAL:
    "Plan requirements before a production step starts. Planning does not consume stock.",
  DOCUMENT_LINK:
    "Choose exactly one target per link. A document can have separate links to several records.",
  OPERATOR_SHIFT:
    "Workstation sessions are recorded when operators sign in, change machines and finish work.",
  SHIFT_CHECK: "Checklist answers are recorded on the operator's current workstation session.",
  JOB_ACTIVITY:
    "Comments, photos and status changes are recorded by the operator workflow and preserved as history.",
  AUDIT_LOG:
    "Change history records the authenticated actor, time, action and fields changed. History cannot be edited.",
  MACHINE_MATERIAL:
    "List the materials a machine supports. Compatibility links do not consume inventory.",
  ASSET: "Attach an accessory to a machine, or give an independent tool its own location.",
  USER_ACCOUNT:
    "Link an employee to an external identity and manage roles. Passwords are configured by the identity provider or hosted-preview settings.",
  FINANCIAL_RECORD:
    "Preserve posted sales and expenses. Record refunds against their original transaction and update paid amounts as payments settle.",
};
const text = (value: unknown) =>
  value == null
    ? ""
    : value instanceof Date
      ? value.toISOString()
      : Array.isArray(value)
        ? value.join(", ")
        : typeof value === "object"
          ? JSON.stringify(value)
          : String(value);
const human = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^./, (letter) => letter.toUpperCase());
function inputValue(field: RecordField, value: unknown) {
  if (field.type === "boolean") return value === true;
  if (field.type === "date") return text(value).slice(0, 10);
  if (field.type === "datetime" && value) {
    const date = new Date(text(value));
    return Number.isNaN(date.getTime())
      ? ""
      : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return text(value);
}
function initialValues(entity: RecordEntity, row: RecordRow | null) {
  const result: Record<string, string | boolean> = {};
  const fields = row ? entity.editFields : entity.createFields;
  for (const field of entity.fields.filter((field) => fields.includes(field.key))) {
    const value = row
      ? row[field.key]
      : (field.defaultValue ??
        (field.type === "boolean" ? false : field.type === "enum" ? field.options?.[0] : ""));
    result[field.key] = inputValue(field, value);
  }
  return result;
}
async function fileData(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("Choose a file smaller than 10 MB.");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

function RecordsPage() {
  const search = Route.useSearch();
  const entityKey = search.entity ?? "CUSTOMER_ORDER";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRecords = useServerFn(getManagementRecords);
  const [query, setQuery] = useState(search.q ?? "");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [upload, setUpload] = useState<File | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
  const result = useQuery({
    queryKey: ["management-records", entityKey, search.offset ?? 0, search.q ?? ""],
    queryFn: () =>
      fetchRecords({
        data: { entity: entityKey, offset: search.offset ?? 0, search: search.q ?? "" },
      }),
    retry: 1,
  });
  const workspace = result.data as Workspace | undefined;
  const entity = workspace?.entities.find((item) => item.key === entityKey);
  const groups = useMemo(
    () => [...new Set(workspace?.entities.map((item) => item.group) ?? [])],
    [workspace?.entities],
  );
  function choose(key: string, record?: string) {
    setOpen(false);
    setQuery("");
    void navigate({ to: "/admin/records", search: { entity: key, ...(record ? { record } : {}) } });
  }
  function edit(row: RecordRow | null) {
    if (!entity) return;
    setEditing(row);
    setValues(initialValues(entity, row));
    setReason("");
    setUpload(null);
    setError(null);
    setRequestKey(crypto.randomUUID());
    setOpen(true);
  }
  useEffect(() => {
    if (search.record && workspace && entity) {
      const row = workspace.rows.find((row) => row["id"] === search.record);
      if (row) edit(row);
    }
    // Opening a shared record link should not reset an in-progress form during a refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.record, entityKey, !!workspace]);
  useEffect(() => setQuery(search.q ?? ""), [search.q]);
  function display(field: RecordField, value: unknown) {
    if (field.reference)
      return workspace?.lookups[field.reference]?.find((item) => item.id === value)?.label ?? "—";
    if (field.type === "boolean") return value ? "Yes" : "No";
    if (field.type === "enum") return value ? human(text(value)) : "—";
    if ((field.type === "date" || field.type === "datetime") && value)
      return new Date(text(value)).toLocaleString("en-GB", {
        timeZone: "Europe/Athens",
        ...(field.type === "date"
          ? { dateStyle: "medium" as const }
          : { dateStyle: "medium" as const, timeStyle: "short" as const }),
      });
    return text(value) || "—";
  }
  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["management-records"] }),
      qc.invalidateQueries({ queryKey: ["admin-snapshot"] }),
    ]);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!entity) return;
    setBusy(true);
    setError(null);
    try {
      const fields = entity.fields.filter((field) =>
        (editing ? entity.editFields : entity.createFields).includes(field.key),
      );
      const payload: Record<string, unknown> = {};
      for (const field of fields) {
        const value = values[field.key];
        if (value === "" || value === undefined) {
          if (editing && field.nullable) payload[field.key] = null;
          continue;
        }
        payload[field.key] =
          field.type === "integer"
            ? Number(value)
            : field.type === "datetime"
              ? new Date(String(value)).toISOString()
              : value;
      }
      const file = upload ? { name: upload.name, data: await fileData(upload) } : undefined;
      await wamRequest(
        `records/${entity.key}${editing ? `/${editing["id"]}` : ""}`,
        {
          values: payload,
          ...(editing && editing["record_version"] ? { version: editing["record_version"] } : {}),
          ...(file ? { file } : {}),
          ...(!editing ? { requestKey } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
        editing ? "PATCH" : "POST",
      );
      setOpen(false);
      toast.success(editing ? "Changes saved" : "Record created");
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!entity || !editing) return;
    setBusy(true);
    setError(null);
    try {
      await wamRequest(
        `records/${entity.key}/${editing["id"]}`,
        {
          values: {},
          ...(editing["record_version"] ? { version: editing["record_version"] } : {}),
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
        "DELETE",
      );
      setOpen(false);
      toast.success("Relationship removed");
      await refresh();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string, filename: string) {
    try {
      const blob = await wamPhoto(`/api/wam/files/${id}`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename || "document";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }
  if (result.isPending)
    return (
      <div className="grid min-h-72 place-items-center">
        <Loader2 className="size-6 animate-spin text-gold" />
      </div>
    );
  if (result.isError || !workspace || !entity)
    return (
      <Panel title="Could not load records">
        <p className="text-sm text-critical">
          {result.error?.message ?? "This collection is not available to your account."}
        </p>
        <Button className="mt-4" onClick={() => result.refetch()}>
          Retry
        </Button>
      </Panel>
    );
  const editableFields = entity.fields.filter((field) =>
    (editing ? entity.editFields : entity.createFields).includes(field.key),
  );
  const locked =
    editing &&
    ((entity.key === "JOB" && editing["status"] === "COMPLETED") ||
      (entity.key === "CUSTOMER_ORDER" &&
        ["DELIVERED", "CANCELLED"].includes(text(editing["status"]))));
  const editable = !locked && editableFields.length > 0;
  const related = [
    ...new Set(
      entity.fields
        .map((field) => field.reference)
        .filter(
          (key): key is string => !!key && workspace.entities.some((entity) => entity.key === key),
        ),
    ),
  ];
  return (
    <>
      <PageHeader
        title="Manage records"
        subtitle="Maintain workshop data, relationships and workflow history."
      />
      <div className="mb-4 flex flex-wrap gap-2">
        {groups.map((group) => (
          <Button
            key={group}
            variant={group === entity.group ? "gold" : "metal"}
            onClick={() => choose(workspace.entities.find((item) => item.group === group)!.key)}
          >
            {group}
          </Button>
        ))}
      </div>
      <Panel title={entity.label}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="min-w-52 flex-1 text-xs text-muted-foreground">
            Record collection
            <select
              aria-label="Record collection"
              value={entityKey}
              onChange={(event) => choose(event.target.value)}
              className="mt-1 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground"
            >
              {groups.map((group) => (
                <optgroup key={group} label={group}>
                  {workspace.entities
                    .filter((item) => item.group === group)
                    .map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void navigate({ to: "/admin/records", search: { entity: entityKey, q: query } });
            }}
          >
            <Input
              aria-label="Search records"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search this collection…"
              className="h-11 bg-surface"
            />
            <Button type="submit" variant="metal" aria-label="Search">
              <Search className="size-4" />
            </Button>
          </form>
          <Button variant="metal" onClick={() => refresh()} aria-label="Refresh records">
            <RefreshCw className="size-4" />
          </Button>
          {entity.createFields.length > 0 && (
            <Button variant="gold" onClick={() => edit(null)}>
              <Plus className="size-4" />
              {entity.upload ? "Upload new revision or file" : "New record"}
            </Button>
          )}
        </div>
        {descriptions[entity.key] && (
          <p className="mb-4 max-w-4xl text-sm text-muted-foreground">{descriptions[entity.key]}</p>
        )}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-border bg-surface">
              <tr>
                {entity.columns
                  .filter((key) => entity.fields.some((field) => field.key === key))
                  .map((key) => (
                    <th key={key} className="px-3 py-3 text-xs font-medium text-muted-foreground">
                      {entity.fields.find((field) => field.key === key)!.label}
                    </th>
                  ))}
                <th className="px-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {workspace.rows.map((row) => (
                <tr key={text(row["id"])} className="hover:bg-elevated/50">
                  {entity.columns
                    .map((key) => entity.fields.find((field) => field.key === key))
                    .filter((field): field is RecordField => !!field)
                    .map((field) => (
                      <td key={field.key} className="max-w-64 px-3 py-3">
                        <span className="block truncate" title={display(field, row[field.key])}>
                          {display(field, row[field.key])}
                        </span>
                      </td>
                    ))}
                  <td className="whitespace-nowrap px-3">
                    <Button variant="ghost" size="sm" onClick={() => edit(row)}>
                      {entity.editFields.length ? "View / edit" : "View"}
                    </Button>
                    {entity.key === "DOCUMENT" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Download ${text(row["title"])}`}
                        onClick={() => download(text(row["id"]), text(row["original_filename"]))}
                      >
                        <Download className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {workspace.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={entity.columns.length + 1}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No records match this collection yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {workspace.total} records · Showing {workspace.total ? workspace.offset + 1 : 0}–
            {Math.min(workspace.offset + workspace.rows.length, workspace.total)}
          </span>
          <div className="flex gap-2">
            <Button
              variant="metal"
              size="sm"
              disabled={workspace.offset === 0}
              onClick={() =>
                void navigate({
                  to: "/admin/records",
                  search: {
                    entity: entityKey,
                    q: search.q,
                    offset: Math.max(0, workspace.offset - workspace.pageSize),
                  },
                })
              }
            >
              Previous
            </Button>
            <Button
              variant="metal"
              size="sm"
              disabled={workspace.offset + workspace.pageSize >= workspace.total}
              onClick={() =>
                void navigate({
                  to: "/admin/records",
                  search: {
                    entity: entityKey,
                    q: search.q,
                    offset: workspace.offset + workspace.pageSize,
                  },
                })
              }
            >
              Next
            </Button>
          </div>
        </div>
        {related.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Related records:</span>
            {related.map((key) => (
              <button
                key={key}
                onClick={() => choose(key)}
                className="rounded-md border border-border px-2 py-1.5 hover:text-gold"
              >
                {workspace.entities.find((item) => item.key === key)!.label}
              </button>
            ))}
          </div>
        )}
      </Panel>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto border-border bg-surface sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? entity.label : "New · " + entity.label}</DialogTitle>
            <DialogDescription>
              {locked
                ? "This completed record is preserved. Append a new revision or rework step instead."
                : (descriptions[entity.key] ?? "Save changes to the workshop database.")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              {(editable ? editableFields : entity.fields).map((field) => {
                const value = editable ? values[field.key] : editing?.[field.key];
                if (!editable)
                  return (
                    <div key={field.key} className="min-w-0">
                      <div className="text-xs text-muted-foreground">{field.label}</div>
                      <div className="mt-1 whitespace-pre-wrap break-words text-sm">
                        {display(field, value)}
                      </div>
                    </div>
                  );
                return (
                  <label
                    key={field.key}
                    className={
                      field.key === "instructions" || field.key === "notes"
                        ? "block text-xs text-muted-foreground sm:col-span-2"
                        : "block text-xs text-muted-foreground"
                    }
                  >
                    {field.label}
                    {field.required && !editing ? " *" : ""}
                    {field.type === "boolean" ? (
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(event) =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: event.target.checked,
                          }))
                        }
                        className="ml-3 size-4 align-middle accent-amber-600"
                      />
                    ) : field.reference || field.type === "enum" ? (
                      <select
                        aria-label={field.label}
                        required={!editing && field.required}
                        value={String(value ?? "")}
                        onChange={(event) =>
                          setValues((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        className="mt-1 h-11 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                      >
                        <option value="">{field.required ? "Choose…" : "Unassigned"}</option>
                        {field.reference
                          ? (workspace.lookups[field.reference] ?? []).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))
                          : field.options?.map((option) => (
                              <option key={option} value={option}>
                                {human(option)}
                              </option>
                            ))}
                      </select>
                    ) : [
                        "instructions",
                        "notes",
                        "special_requests",
                        "qc_notes",
                        "cancellation_reason",
                        "blocked_reason",
                      ].includes(field.key) ? (
                      <textarea
                        aria-label={field.label}
                        value={String(value ?? "")}
                        onChange={(event) =>
                          setValues((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        rows={3}
                        maxLength={field.max ?? 20000}
                        required={!editing && field.required}
                        className="mt-1 w-full rounded-lg border border-border bg-background p-3 text-sm text-foreground"
                      />
                    ) : (
                      <Input
                        aria-label={field.label}
                        type={
                          field.type === "integer" || field.type === "decimal"
                            ? "number"
                            : field.type === "date"
                              ? "date"
                              : field.type === "datetime"
                                ? "datetime-local"
                                : "text"
                        }
                        step={field.type === "integer" ? "1" : "any"}
                        value={String(value ?? "")}
                        required={!editing && field.required}
                        maxLength={field.max}
                        onChange={(event) =>
                          setValues((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        className="mt-1 h-11 bg-background"
                      />
                    )}
                  </label>
                );
              })}
            </div>
            {!editing && entity.upload && (
              <label className="block text-xs text-muted-foreground">
                {entity.upload === "template" ? "Preserved design file" : "Document file"} *
                <Input
                  aria-label="Upload file"
                  type="file"
                  required
                  onChange={(event) => setUpload(event.target.files?.[0] ?? null)}
                  className="mt-1 h-12 bg-background"
                />
                <span className="mt-1 block">
                  Maximum 10 MB. File size and checksum are recorded from the uploaded bytes.
                </span>
              </label>
            )}
            {editable && (
              <label className="block text-xs text-muted-foreground">
                Reason for change
                <Input
                  aria-label="Reason for change"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 bg-background"
                  placeholder="Optional, required for an approval exemption"
                />
              </label>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-critical/40 bg-critical/10 p-3 text-sm text-critical"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              {editing && entity.removable && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={remove}
                  className="mr-auto"
                >
                  Remove relationship
                </Button>
              )}
              <Button type="button" variant="metal" onClick={() => setOpen(false)} disabled={busy}>
                Close
              </Button>
              {editable && (
                <Button type="submit" variant="gold" disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  {editing ? "Save changes" : "Create record"}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
