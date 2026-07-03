"use client";

import { useEffect, useRef, useState } from "react";
import type { Lang } from "@/lib/huntI18n";

const TXT = {
  scan: { ar: "امسح رمز الكنز", en: "Scan a mark" },
  close: { ar: "إغلاق", en: "Close" },
  notHunt: { ar: "هذا ليس رمز الكنز", en: "Not a hunt code" },
  camError: {
    ar: "تعذّر تشغيل الكاميرا — استخدم كاميرا هاتفك العادية بدلًا من ذلك",
    en: "Camera unavailable — use your phone's normal camera instead",
  },
};

/** Extracts /s/<slug>?t=<token> from a decoded QR, whatever the domain. */
function parseHuntUrl(text: string): { slug: string; token: string } | null {
  try {
    const url = new URL(text.trim());
    const m = url.pathname.match(/^\/s\/([a-z0-9-]+)$/i);
    const token = url.searchParams.get("t");
    if (m && token) return { slug: m[1], token };
  } catch {
    /* not a URL */
  }
  return null;
}

export function HuntScanner({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let instance: { stop: () => Promise<void>; clear: () => void } | null = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode("hunt-qr-reader");
      instance = scanner as unknown as typeof instance;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            const now = Date.now();
            if (lastRef.current.text === text && now - lastRef.current.at < 3000) return;
            lastRef.current = { text, at: now };
            const hit = parseHuntUrl(text);
            if (hit) {
              // reuse the exact same server path as a native camera scan
              window.location.href = `/s/${hit.slug}?t=${encodeURIComponent(hit.token)}`;
            } else {
              setError(TXT.notHunt[lang]);
              setTimeout(() => setError(""), 2500);
            }
          },
          () => {}
        );
      } catch {
        setError(TXT.camError[lang]);
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      instance?.stop().then(() => instance?.clear()).catch(() => {});
    };
  }, [open, lang]);

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button onClick={() => setOpen(true)} className="btn btn-gold w-full text-lg py-4">
          📷 {TXT.scan[lang]}
        </button>
      ) : (
        <div className="panel overflow-hidden relative aspect-square">
          <div id="hunt-qr-reader" className="w-full h-full" />
          <button
            onClick={() => setOpen(false)}
            className="absolute top-3 end-3 z-10 btn btn-outline text-xs px-3 py-1.5 bg-black/60"
          >
            ✕ {TXT.close[lang]}
          </button>
        </div>
      )}
      {error && <p className="text-bloodbright text-sm text-center">{error}</p>}
    </div>
  );
}
