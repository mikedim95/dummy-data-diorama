import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWam } from "@/lib/wam/store";
import type { Task } from "@/lib/wam/types";

export function TaskMaterials({ task, editable }: { task: Task; editable: boolean }) {
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
        Materials & actual usage
      </h2>
      {(task.plannedMaterials ?? []).map((item) => (
        <div key={item.materialId} className="rounded-xl border border-border p-3 text-sm">
          <strong>{item.name}</strong>
          <p>
            Planned: {item.plannedQuantity} {item.unit} · Used: {item.actualQuantity} {item.unit}
          </p>
        </div>
      ))}
      {!task.plannedMaterials?.length && (
        <p className="text-sm text-muted-foreground">No material requirements planned.</p>
      )}
      {editable && (
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
              toast.error("Choose a material, location and positive quantity.");
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
              toast.success("Material movement recorded.");
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-sm">
            Material
            <select
              aria-label="Material"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2"
              value={material}
              onChange={(event) => setMaterial(event.target.value)}
              required
            >
              <option value="">Choose material</option>
              {materialOptions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Movement
            <select
              aria-label="Movement"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2"
              value={movement}
              onChange={(event) => setMovement(event.target.value as typeof movement)}
            >
              <option value="CONSUMPTION">Record usage</option>
              <option value="RETURN">Return unused stock</option>
            </select>
          </label>
          <label className="block text-sm">
            Stock location
            <select
              aria-label="Stock location"
              className="mt-1 h-10 w-full rounded-md border bg-background px-2"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              required
            >
              <option value="">Choose location</option>
              {stockLocations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted-foreground">
            Available here: {available} {materialOptions.find((item) => item.id === material)?.unit}
          </p>
          <label className="block text-sm">
            Quantity
            <Input
              aria-label="Quantity"
              type="number"
              min="0.0001"
              step="any"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              required
            />
          </label>
          <Button className="w-full" disabled={busy} type="submit">
            {busy ? "Saving…" : "Save material movement"}
          </Button>
        </form>
      )}
    </section>
  );
}
