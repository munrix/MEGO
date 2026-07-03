"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type EventOpt = { id: string; name: string; venue: string };

type Verdict = {
  result: string;
  ticket?: {
    id: string;
    shortCode: string;
    tier: string;
    status: string;
    holderName: string | null;
    checkedInAt: string | null;
    checkedInByName?: string | null;
  };
  checkedIn?: boolean;
  message: string;
};

const VERDICT_STYLES: Record<string, { bg: string; title: string; icon: string }> = {
  OK: { bg: "bg-[#0d3320]", title: "WELCOME, BROTHER", icon: "✔" },
  DUPLICATE: { bg: "bg-[#3d3413]", title: "ALREADY AMONG US", icon: "⚠" },
  REVOKED: { bg: "bg-[#3a1016]", title: "TICKET REVOKED", icon: "✕" },
  BLACKLISTED: { bg: "bg-[#3a1016]", title: "TEMPLAR!", icon: "☠" },
  INVALID: { bg: "bg-[#3a1016]", title: "FORGERY", icon: "✕" },
  WRONG_EVENT: { bg: "bg-[#3d3413]", title: "WRONG EVENT", icon: "⚠" },
  EVENT_CLOSED: { bg: "bg-[#3a1016]", title: "GATES CLOSED", icon: "✕" },
};

export function Scanner({
  events,
  preselected,
}: {
  events: EventOpt[];
  preselected?: string;
}) {
  const [eventId, setEventId] = useState(
    preselected && events.some((e) => e.id === preselected)
      ? preselected
      : events.length === 1
      ? events[0].id
      : ""
  );
  const [running, setRunning] = useState(false);
  const [autoCheckIn, setAutoCheckIn] = useState(true);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [camError, setCamError] = useState("");

  // html5-qrcode instance kept in a ref; imported dynamically (browser-only lib)
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const lastScanRef = useRef<{ text: string; at: number }>({ text: "", at: 0 });
  const busyRef = useRef(false);

  const submitScan = useCallback(
    async (body: Record<string, unknown>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const res = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, eventId, autoCheckIn }),
        });
        const v: Verdict = await res.json();
        setVerdict(v);
        if (navigator.vibrate) {
          navigator.vibrate(v.result === "OK" ? 80 : [80, 60, 80, 60, 200]);
        }
      } catch {
        setVerdict({ result: "INVALID", message: "Network error — try again." });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [eventId, autoCheckIn]
  );

  const onDecoded = useCallback(
    (text: string) => {
      const now = Date.now();
      // ignore repeat reads of the same code within 3s (camera sees it continuously)
      if (lastScanRef.current.text === text && now - lastScanRef.current.at < 3000) return;
      lastScanRef.current = { text, at: now };
      submitScan({ payload: text });
    },
    [submitScan]
  );

  useEffect(() => {
    if (!running || !eventId) return;
    let cancelled = false;
    let instance: { stop: () => Promise<void>; clear: () => void } | null = null;

    (async () => {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode("qr-reader");
      instance = scanner as unknown as typeof instance;
      scannerRef.current = instance;
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (text) => onDecoded(text),
          () => {} // per-frame decode misses are normal; stay quiet
        );
        setCamError("");
      } catch (e) {
        setCamError(
          e instanceof Error && e.message.includes("Permission")
            ? "Camera permission denied. Allow camera access and retry."
            : "Could not start camera. Note: camera needs HTTPS (or localhost)."
        );
        setRunning(false);
      }
    })();

    return () => {
      cancelled = true;
      instance?.stop().then(() => instance?.clear()).catch(() => {});
      scannerRef.current = null;
    };
  }, [running, eventId, onDecoded]);

  const dismiss = () => setVerdict(null);

  const selectedEvent = events.find((e) => e.id === eventId);

  if (events.length === 0) {
    return (
      <div className="panel p-6 text-center">
        <p className="text-muted">No open events. Open an event before scanning.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 max-w-lg mx-auto">
      <h1 className="text-2xl text-goldbright">The Gate</h1>

      {/* event picker */}
      <div>
        <label className="field">Scanning for</label>
        <select
          className="input"
          value={eventId}
          onChange={(e) => {
            setEventId(e.target.value);
            setRunning(false);
          }}
        >
          <option value="">— choose event —</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} · {e.venue}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-3 panel px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={autoCheckIn}
          onChange={(e) => setAutoCheckIn(e.target.checked)}
          className="w-5 h-5 accent-[#c9a35c]"
        />
        <div>
          <p className="font-semibold text-sm">Auto check-in</p>
          <p className="text-muted text-xs">
            Valid scans are checked in instantly — fastest for busy gates.
          </p>
        </div>
      </label>

      {/* camera area */}
      <div className="panel overflow-hidden relative aspect-square">
        <div id="qr-reader" className="w-full h-full" />
        {!running && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-panel">
            <span className="text-5xl opacity-40">◈</span>
            {camError && (
              <p className="text-bloodbright text-sm text-center px-6">{camError}</p>
            )}
            <button
              className="btn btn-gold"
              disabled={!eventId}
              onClick={() => setRunning(true)}
            >
              {eventId ? "Start Scanning" : "Choose an event first"}
            </button>
          </div>
        )}
        {running && (
          <button
            onClick={() => setRunning(false)}
            className="absolute top-3 right-3 z-10 btn btn-outline text-xs px-3 py-1.5 bg-black/60"
          >
            Stop
          </button>
        )}
      </div>

      {/* manual fallback */}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (manualCode.trim()) {
            submitScan({ code: manualCode });
            setManualCode("");
          }
        }}
      >
        <input
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          placeholder="Code fallback: BF-XXXXX"
          className="input font-mono uppercase"
          autoCapitalize="characters"
        />
        <button className="btn btn-outline shrink-0" disabled={busy || !eventId}>
          Check
        </button>
      </form>

      {selectedEvent && (
        <p className="text-muted text-xs text-center">
          Gate: {selectedEvent.name} — every scan is logged under your name.
        </p>
      )}

      {/* verdict overlay */}
      {verdict && (
        <VerdictOverlay
          verdict={verdict}
          onDismiss={dismiss}
          onCheckIn={async () => {
            if (!verdict.ticket) return;
            await fetch("/api/checkin", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ticketId: verdict.ticket.id }),
            });
            setVerdict({
              ...verdict,
              checkedIn: true,
              message: "Welcome, Brother. Entry granted.",
            });
          }}
        />
      )}
    </div>
  );
}

function VerdictOverlay({
  verdict,
  onDismiss,
  onCheckIn,
}: {
  verdict: Verdict;
  onDismiss: () => void;
  onCheckIn: () => Promise<void>;
}) {
  const style = VERDICT_STYLES[verdict.result] ?? VERDICT_STYLES.INVALID;
  const t = verdict.ticket;
  const showCheckIn = verdict.result === "OK" && !verdict.checkedIn;

  // auto-dismiss successful auto-check-ins quickly to keep the line moving
  useEffect(() => {
    if (verdict.result === "OK" && verdict.checkedIn) {
      const timer = setTimeout(onDismiss, 1800);
      return () => clearTimeout(timer);
    }
  }, [verdict, onDismiss]);

  return (
    <div
      className={`fixed inset-0 z-50 ${style.bg} verdict-enter flex flex-col items-center justify-center gap-4 px-6 text-center`}
      onClick={verdict.result === "OK" && verdict.checkedIn ? onDismiss : undefined}
    >
      <span className="text-7xl">{style.icon}</span>
      <h2 className="text-3xl font-bold tracking-widest">{style.title}</h2>

      {t && (
        <div className="flex flex-col items-center gap-1">
          <p className="text-2xl font-semibold">
            {t.holderName || "Bearer ticket"}
          </p>
          {t.tier === "VIP" && (
            <span className="badge badge-vip text-base px-4 py-1">★ BROTHERHOOD VIP ★</span>
          )}
          <p className="font-mono text-sm opacity-70">{t.shortCode}</p>
          {verdict.result === "DUPLICATE" && t.checkedInAt && (
            <p className="text-sm opacity-80 mt-2">
              First entry: {new Date(t.checkedInAt).toLocaleTimeString()}
              {t.checkedInByName ? ` — by ${t.checkedInByName}` : ""}
            </p>
          )}
        </div>
      )}

      <p className="opacity-90 max-w-xs">{verdict.message}</p>

      <div className="flex gap-3 mt-4">
        {showCheckIn && (
          <button className="btn btn-green text-lg px-8 py-3" onClick={onCheckIn}>
            Check In
          </button>
        )}
        <button className="btn btn-outline text-lg px-8 py-3" onClick={onDismiss}>
          {verdict.result === "OK" && verdict.checkedIn ? "Next" : "Dismiss"}
        </button>
      </div>
    </div>
  );
}
