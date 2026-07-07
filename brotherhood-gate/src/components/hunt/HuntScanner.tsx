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
  const videoRef = useRef<HTMLVideoElement>(null);
  const reticleRef = useRef<HTMLDivElement>(null);
  const lastErrorRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let scanner: { start: () => Promise<void>; destroy: () => void } | null = null;
    let navigating = false;
    let idleTimer = 0;

    // idle reticle: a large centered square inviting the user to aim anywhere
    const resetReticle = () => {
      const r = reticleRef.current;
      if (!r) return;
      r.style.left = "19%";
      r.style.top = "19%";
      r.style.width = "62%";
      r.style.height = "62%";
      r.dataset.state = "seek";
    };

    // snap the reticle onto the code's corner points, mapping camera-frame
    // coordinates onto the on-screen video (which is object-fit: cover)
    const trackReticle = (pts: Array<{ x: number; y: number }>, good: boolean) => {
      const r = reticleRef.current;
      const v = videoRef.current;
      if (!r || !v || !v.videoWidth || !v.videoHeight) return;
      const scale = Math.max(v.clientWidth / v.videoWidth, v.clientHeight / v.videoHeight);
      const offX = (v.clientWidth - v.videoWidth * scale) / 2;
      const offY = (v.clientHeight - v.videoHeight * scale) / 2;
      const xs = pts.map((p) => p.x * scale + offX);
      const ys = pts.map((p) => p.y * scale + offY);
      const pad = 12;
      r.style.left = `${Math.min(...xs) - pad}px`;
      r.style.top = `${Math.min(...ys) - pad}px`;
      r.style.width = `${Math.max(...xs) - Math.min(...xs) + pad * 2}px`;
      r.style.height = `${Math.max(...ys) - Math.min(...ys) + pad * 2}px`;
      r.dataset.state = good ? "locked" : "bad";
      // drift back to the idle frame if the code leaves the view
      clearTimeout(idleTimer);
      idleTimer = window.setTimeout(resetReticle, 900);
    };

    (async () => {
      const { default: QrScanner } = await import("qr-scanner");
      if (cancelled || !videoRef.current) return;

      const qr = new QrScanner(
        videoRef.current,
        (result) => {
          if (navigating) return;
          const hit = parseHuntUrl(result.data);
          if (result.cornerPoints?.length) trackReticle(result.cornerPoints, !!hit);
          if (hit) {
            navigating = true;
            clearTimeout(idleTimer);
            navigator.vibrate?.(80);
            // let the lock-on animation land before leaving the page;
            // reuses the exact same server path as a native camera scan
            setTimeout(() => {
              window.location.href = `/s/${hit.slug}?t=${encodeURIComponent(hit.token)}`;
            }, 350);
          } else {
            const now = Date.now();
            if (lastErrorRef.current.text !== result.data || now - lastErrorRef.current.at > 3000) {
              lastErrorRef.current = { text: result.data, at: now };
              setError(TXT.notHunt[lang]);
              setTimeout(() => setError(""), 2500);
            }
          }
        },
        {
          preferredCamera: "environment",
          maxScansPerSecond: 15,
          returnDetailedScanResult: true,
          highlightScanRegion: false,
          highlightCodeOutline: false,
          // scan the whole camera frame (downscaled for speed), not just a
          // centered box — codes are picked up anywhere in the view
          calculateScanRegion: (v: HTMLVideoElement) => {
            const target = 640;
            const s = Math.min(1, target / Math.max(v.videoWidth, v.videoHeight, 1));
            return {
              x: 0,
              y: 0,
              width: v.videoWidth,
              height: v.videoHeight,
              downScaledWidth: Math.round(v.videoWidth * s),
              downScaledHeight: Math.round(v.videoHeight * s),
            };
          },
        }
      );
      scanner = qr;
      try {
        await qr.start();
        if (cancelled) return;
        resetReticle();
      } catch {
        setError(TXT.camError[lang]);
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(idleTimer);
      scanner?.destroy();
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
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <div ref={reticleRef} className="hunt-reticle" data-state="seek" />
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
