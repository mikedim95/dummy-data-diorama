import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { useState } from "react";
import { Check, ChevronDown, Info, SkipForward } from "lucide-react";
import type { CheckState, MaintenanceItem } from "@/lib/wam/types";
import { MaintPriority } from "./bits";
import { cn } from "@/lib/utils";

export function MaintenanceReminder({
  item,
  state,
  onChange,
  allowSkip = false,
  index = 0,
}: {
  item: MaintenanceItem;
  state?: CheckState | undefined;
  onChange: (v: CheckState | null) => void;
  allowSkip?: boolean;
  index?: number;
}) {
  useLanguage();
  const [open, setOpen] = useState(false);
  const isInfo = item.kind === "info";
  const flagged = item.priority === "safety" || item.priority === "overdue";

  return (
    <div
      className={cn(
        "animate-rise overflow-hidden rounded-2xl border transition-colors duration-200",
        isInfo ? "border-dashed border-border bg-surface/50" : "bg-metal border-border",
        item.priority === "safety" && !state && "border-critical/50",
        item.priority === "overdue" && !state && "border-warning/50",
        state === "done" && "border-success/40",
      )}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-start gap-3 p-3">
        {tv(
          isInfo ? (
            <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted">
              <Info className="size-5 text-muted-foreground" />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onChange(state === "done" ? null : "done")}
              aria-pressed={state === "done"}
              aria-label={t('Mark "{0}" as checked', t(item.title))}
              className={cn(
                "press grid size-11 shrink-0 place-items-center rounded-xl border-2 transition-colors",
                state === "done"
                  ? "border-success bg-success/20 text-success"
                  : state === "skipped"
                    ? "border-warning/60 text-warning"
                    : "border-border bg-background/40",
              )}
            >
              {tv(state === "done" && <Check className="size-5" />)}
              {tv(state === "skipped" && <SkipForward className="size-4" />)}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
          aria-expanded={open}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <MaintPriority p={item.priority} />
            {tv(
              isInfo && (
                <span className="text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {t("Info")}
                </span>
              ),
            )}
          </div>
          <div
            className={cn(
              "mt-0.5 text-sm font-semibold",
              state === "done" && "text-muted-foreground line-through decoration-success/60",
            )}
          >
            {tv(t(item.title))}
          </div>
          {tv(
            item.dueNote && (
              <div className={cn("text-xs", flagged ? "text-warning" : "text-muted-foreground")}>
                {t(item.dueNote)}
              </div>
            ),
          )}
          {tv(
            state === "skipped" && (
              <div className="text-xs text-warning">{t("Skipped — explain in handover note")}</div>
            ),
          )}
        </button>
        {tv(
          item.instructions && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="press grid size-11 shrink-0 place-items-center rounded-xl text-muted-foreground"
              aria-label={t("Show instructions")}
            >
              <ChevronDown
                className={cn("size-5 transition-transform duration-200", open && "rotate-180")}
              />
            </button>
          ),
        )}
      </div>
      {tv(
        open && item.instructions && (
          <div className="animate-rise border-t border-border/60 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
            {tv(item.instructions)}
            {tv(
              allowSkip && !isInfo && state !== "done" && (
                <button
                  type="button"
                  onClick={() => onChange(state === "skipped" ? null : "skipped")}
                  className="press mt-3 flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-xs font-medium text-foreground"
                >
                  <SkipForward className="size-4" />
                  {tv(" ")}
                  {tv(state === "skipped" ? t("Undo skip") : t("Can't complete — skip"))}
                </button>
              ),
            )}
          </div>
        ),
      )}
    </div>
  );
}
