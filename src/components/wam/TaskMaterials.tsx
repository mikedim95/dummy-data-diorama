import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWam } from "@/lib/wam/store";
import type { Task } from "@/lib/wam/types";

export function TaskMaterials({ task, editable }: { task: Task; editable: boolean }) {
  useLanguage();
  const { materialOptions, stockLocations, stockBalances, postMaterial } = useWam();
  const [material, setMaterial] = useState(task.plannedMaterials?.[0]?.materialId ?? "");
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [movement, setMovement] = useState<"CONSUMPTION" | "RETURN">("CONSUMPTION");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState<{ signature: string; key: string } | null>(null);
  const available =
    stockBalances.find((item) => item.materialId === material && item.locationId === location)
      ?.quantity ?? 0;
  return (
    <section className="mt-5 space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("Materials & actual usage")}
      </h2>
      {tv(
        (task.plannedMaterials ?? []).map((item) => (
          <div key={item.materialId} className="rounded-xl border border-border p-3 text-sm">
            <strong>{tv(item.name)}</strong>
            <p>
              {t("Planned:")} {tv(item.plannedQuantity)} {tv(item.unit)} {t("· Used:")}
              {tv(" ")}
              {tv(item.actualQuantity)} {tv(item.unit)}
            </p>
          </div>
        )),
      )}
      {tv(
        !task.plannedMaterials?.length && (
          <p className="text-sm text-muted-foreground">{t("No material requirements planned.")}</p>
        ),
      )}
      {tv(
        editable && (
          <form
            className="space-y-2 rounded-xl border border-border p-3"
            onSubmit={async (event) => {
              event.preventDefault();
              if (
                !material ||
                !location ||
                !Number.isFinite(Number(quantity)) ||
                Number(quantity) <= 0
              ) {
                toast.error(t("Choose a material, location and positive quantity."));
                return;
              }
              const payload = {
                material_id: material,
                job_id: task.id,
                quantity: Number(quantity),
                movement_type: movement,
                ...(movement === "CONSUMPTION"
                  ? { from_location_id: location }
                  : { to_location_id: location }),
              };
              const signature = JSON.stringify(payload);
              const request_key = retry?.signature === signature ? retry.key : crypto.randomUUID();
              setRetry({ signature, key: request_key });
              setBusy(true);
              try {
                await postMaterial({ ...payload, request_key });
                setRetry(null);
                setQuantity("");
                toast.success(t("Material movement recorded."));
              } catch (error) {
                toast.error(tv((error as Error).message));
              } finally {
                setBusy(false);
              }
            }}
          >
            <label className="block text-sm">
              {t("Material")}
              <select
                aria-label={t("Material")}
                className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                value={material}
                onChange={(event) => setMaterial(event.target.value)}
                required
              >
                <option value="">{t("Choose material")}</option>
                {tv(
                  materialOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {tv(item.name)} ({tv(item.unit)})
                    </option>
                  )),
                )}
              </select>
            </label>
            <label className="block text-sm">
              {t("Movement")}
              <select
                aria-label={t("Movement")}
                className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                value={movement}
                onChange={(event) => setMovement(event.target.value as typeof movement)}
              >
                <option value="CONSUMPTION">{t("Record usage")}</option>
                <option value="RETURN">{t("Return unused stock")}</option>
              </select>
            </label>
            <label className="block text-sm">
              {t("Stock location")}
              <select
                aria-label={t("Stock location")}
                className="mt-1 h-10 w-full rounded-md border bg-background px-2"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                required
              >
                <option value="">{t("Choose location")}</option>
                {tv(
                  stockLocations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {tv(item.name)}
                    </option>
                  )),
                )}
              </select>
            </label>
            <p className="text-xs text-muted-foreground">
              {t("Available here:")} {tv(available)}
              {tv(" ")}
              {tv(materialOptions.find((item) => item.id === material)?.unit)}
            </p>
            <label className="block text-sm">
              {t("Quantity")}
              <Input
                aria-label={t("Quantity")}
                type="number"
                min="0.0001"
                step="any"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </label>
            <Button className="w-full" disabled={busy} type="submit">
              {tv(busy ? t("Saving…") : t("Save material movement"))}
            </Button>
          </form>
        ),
      )}
    </section>
  );
}
