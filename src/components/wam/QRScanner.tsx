import { translate as t, translateValue as tv, useLanguage } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { CameraOff } from "lucide-react";

/** Camera QR scanner. html5-qrcode is imported only after mount (browser-only). */
export function QRScanner({
  onResult,
  onError,
}: {
  onResult: (text: string) => void;
  onError: (msg: string) => void;
}) {
  useLanguage();
  const id = "wam-qr-region";
  const done = useRef(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let scanner: { stop: () => Promise<void>; isScanning?: boolean } | null = null;
    let cancelled = false;
    (async () => {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices)
          throw new Error("Camera needs a secure (HTTPS) connection.");
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const s = new Html5Qrcode(id, { verbose: false });
        scanner = s;
        await s.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: (w, h) => {
              const m = Math.floor(Math.min(w, h) * 0.7);
              return { width: m, height: m };
            },
          },
          (text) => {
            if (done.current) return;
            done.current = true;
            navigator.vibrate?.(40);
            onResult(text);
          },
          () => {},
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const friendly = /permission|notallowed/i.test(msg)
          ? "Camera access was denied."
          : /notfound|no camera/i.test(msg)
            ? "No camera found on this device."
            : msg;
        setFailed(friendly);
        onError(friendly);
      }
    })();
    return () => {
      cancelled = true;
      if (scanner?.isScanning !== false) scanner?.stop().catch(() => {});
    };
  }, [onResult, onError]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-xs overflow-hidden rounded-3xl border border-border bg-background">
      <div
        id={id}
        className="absolute inset-0 [&_video]:h-full! [&_video]:w-full! [&_video]:object-cover"
      />
      {tv(
        failed ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">
            <div>
              <CameraOff className="mx-auto mb-2 size-8" />
              {tv(failed)}
              <div className="mt-1 text-xs">{t("Enter the machine code below instead.")}</div>
            </div>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-[15%]">
            {tv(
              [
                "top-0 left-0 border-t-2 border-l-2 rounded-tl-xl",
                "top-0 right-0 border-t-2 border-r-2 rounded-tr-xl",
                "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl",
                "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl",
              ].map((c) => <span key={c} className={`absolute size-8 border-gold ${c}`} />),
            )}
            <span className="animate-scanline absolute inset-x-2 top-0 h-px bg-gold/70" />
          </div>
        ),
      )}
    </div>
  );
}
