import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { useRef } from "react";
import { Camera, X } from "lucide-react";

/** Downscale large phone photos before attaching (max 1280px, JPEG 0.75). */
export async function compressImage(file: File, max = 1280, q = 0.75): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", q);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function PhotoUploader({
  photos,
  onChange,
}: {
  photos: string[];
  onChange: (p: string[]) => void;
}) {
  useLanguage();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {tv(
        photos.map((p, i) => (
          <div
            key={i}
            className="animate-rise relative size-20 overflow-hidden rounded-xl border border-border"
          >
            <img src={p} alt={t("Attached photo {0}", i + 1)} className="size-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 grid size-7 place-items-center rounded-full bg-background/80 text-foreground"
              aria-label={t("Remove photo")}
            >
              <X className="size-4" />
            </button>
          </div>
        )),
      )}
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="press grid size-20 place-items-center rounded-xl border border-dashed border-brass/60 text-brass"
      >
        <div className="text-center text-[11px]">
          <Camera className="mx-auto mb-1 size-5" />
          {t("Add photo")}
        </div>
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          const out = await Promise.all(files.map((f) => compressImage(f)));
          onChange([...photos, ...out]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
