"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import Link from "next/link";

type CheckResult = {
  valid: boolean;
  used?: boolean;
  tier?: string;
  event?: string;
  date?: string;
  message: string;
};

export default function PublicCheckPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [camError, setCamError] = useState("");
  const lastRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const check = useCallback(async (body: Record<string, string>) => {
    setBusy(true);
    try {
      const res = await fetch("/api/public/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult(await res.json());
    } catch {
      setResult({ valid: false, message: "Network error — try again." });
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!scanning) return;
    let cancelled = false;
    let instance: { stop: () => Promise<void>; clear: () => void } | null = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode("qr-reader");
      instance = scanner as unknown as typeof instance;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (text) => {
            const now = Date.now();
            if (lastRef.current.text === text && now - lastRef.current.at < 4000) return;
            lastRef.current = { text, at: now };
            check({ payload: text });
          },
          () => {}
        );
        setCamError("");
      } catch {
        setCamError("Camera unavailable. Enter your code below instead.");
        setScanning(false);
      }
    })();

    return () => {
      cancelled = true;
      instance?.stop().then(() => instance?.clear()).catch(() => {});
    };
  }, [scanning, check]);

  return (
    <main
      className="min-h-dvh flex flex-col items-center px-6 py-10 bg-cover bg-center relative"
      style={{ backgroundImage: "url(/theme/bg-login.jpg)" }}
    >
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative w-full max-w-sm flex flex-col items-center gap-6">
        <Image
          src="/theme/mego-wordmark.png"
          alt="MEGO"
          width={240}
          height={62}
          priority
          className="rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
        />
        <div className="panel w-full p-5 bg-black/60! backdrop-blur-sm flex flex-col gap-4">
          <div className="text-center">
            <h1 className="text-lg text-goldbright">Verify Your Ticket</h1>
            <p className="text-muted text-sm">
              Scan your ticket&apos;s QR or type its code.
            </p>
          </div>

          <div className="panel overflow-hidden relative aspect-square bg-panel2">
            <div id="qr-reader" className="w-full h-full" />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                {camError && (
                  <p className="text-bloodbright text-xs text-center px-4">{camError}</p>
                )}
                <button className="btn btn-gold" onClick={() => setScanning(true)}>
                  📷 Scan QR
                </button>
              </div>
            )}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (code.trim()) check({ code });
            }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="BF-XXXXX"
              className="input font-mono uppercase"
              autoCapitalize="characters"
            />
            <button className="btn btn-outline shrink-0" disabled={busy}>
              Check
            </button>
          </form>

          {result && (
            <div
              className={`rounded-lg p-4 text-center border ${
                result.valid
                  ? "bg-creed/15 border-creed"
                  : "bg-blood/15 border-blood"
              }`}
            >
              <p className="text-3xl mb-1">{result.valid ? "✔" : "✕"}</p>
              <p className="font-semibold">
                {result.valid ? "Valid Ticket" : "Not Valid"}
              </p>
              {result.event && (
                <p className="text-sm mt-1">
                  {result.event}
                  {result.tier === "VIP" && (
                    <span className="badge badge-vip ml-2">VIP</span>
                  )}
                </p>
              )}
              {result.date && (
                <p className="text-muted text-xs mt-0.5">
                  {new Date(result.date).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              )}
              <p className="text-muted text-sm mt-2">{result.message}</p>
            </div>
          )}
        </div>
        <Link
          href="/login"
          className="text-muted text-sm underline underline-offset-4 hover:text-goldbright"
        >
          Staff entrance →
        </Link>
      </div>
    </main>
  );
}
