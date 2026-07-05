"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { t, dirOf, type Lang } from "@/lib/huntI18n";
import { useLang, LangToggle } from "@/components/hunt/lang";
import { HuntScanner } from "@/components/hunt/HuntScanner";

type State = {
  phase: "before_registration" | "registration" | "open" | "closed";
  registered: boolean;
  name?: string;
  winnersCount: number;
  maxWinners: number;
  required: number;
  foundCount?: number;
  medallions?: Array<{ slug: string; nameEn: string; nameAr: string; lit: boolean }>;
  clue?: {
    en: string;
    ar: string;
    nameEn: string;
    nameAr: string;
    hintFloor: string | null;
    hintReady: boolean;
  } | null;
  completed?: { at: string; placement: number; isWinner: boolean; minutes: number } | null;
  leaderboard?: Array<{ name: string; placement: number }>;
  opensAt: string;
};

type Celebration = {
  kind: string;
  stationName?: { en: string; ar: string };
  found?: number;
  early?: boolean;
  placement?: number;
  isWinner?: boolean;
};

export default function HuntPlay() {
  const [lang, setLang] = useLang();
  const [state, setState] = useState<State | null>(null);
  const [celebrate, setCelebrate] = useState<Celebration | null>(null);
  const router = useRouter();

  // scan outcome arrives via query string from /s/[slug]; show it once
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const kind = q.get("scan");
    if (!kind) return;
    setCelebrate({
      kind,
      stationName: q.get("sn")
        ? { en: q.get("sn")!, ar: q.get("sa") ?? q.get("sn")! }
        : undefined,
      found: q.get("f") ? parseInt(q.get("f")!, 10) : undefined,
      early: q.get("early") === "1",
      placement: q.get("p") ? parseInt(q.get("p")!, 10) : undefined,
      isWinner: q.get("w") === "1",
    });
    window.history.replaceState(null, "", "/hunt/play");
    if (navigator.vibrate) navigator.vibrate(kind === "ok" || kind === "completed" ? 120 : [60, 40, 60]);
  }, []);

  // auto-dismiss successful finds so the next clue appears
  useEffect(() => {
    if (celebrate && (celebrate.kind === "ok" || celebrate.kind === "already")) {
      const id = setTimeout(() => setCelebrate(null), 2500);
      return () => clearTimeout(id);
    }
  }, [celebrate]);

  const load = useCallback(async () => {
    try {
      const s = await fetch("/api/hunt/state").then((r) => r.json());
      if (!s.registered) {
        router.replace("/hunt");
        return;
      }
      setState(s);
    } catch {
      /* poll again */
    }
  }, [router]);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  if (!state) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <span className="text-4xl animate-pulse">🏴‍☠️</span>
      </main>
    );
  }

  const dir = dirOf(lang);

  return (
    <main dir={dir} className="min-h-dvh flex flex-col items-center px-5 py-6">
      <div className="w-full max-w-sm flex flex-col gap-5">
        {/* top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/theme/crest-white.png" alt="" width={30} height={30} />
            <span className="text-goldbright text-sm font-semibold">
              {state.name?.split(/\s+/)[0]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="badge badge-vip">
              🗝 {state.winnersCount}/{state.maxWinners} {t.keysClaimed[lang]}
            </span>
            <LangToggle lang={lang} onChange={setLang} />
          </div>
        </div>

        {/* medallion progress */}
        <div className="panel p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-muted text-xs uppercase tracking-widest">
              {t.progress[lang]}
            </span>
            <span className="stat-value text-2xl text-goldbright font-bold">
              {state.foundCount}/{state.required}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2.5">
            {state.medallions?.map((m) => (
              <div
                key={m.slug}
                className={`aspect-square rounded-full border-2 flex flex-col items-center justify-center text-center transition-all ${
                  m.lit
                    ? "border-gold bg-gold/20 shadow-[0_0_14px_rgba(201,163,92,0.4)]"
                    : "border-line bg-panel2 opacity-50"
                }`}
              >
                <span className="text-xl leading-none">{m.lit ? "🏴‍☠️" : "◈"}</span>
                <span className="text-[0.55rem] mt-0.5 px-1 leading-tight">
                  {lang === "ar" ? m.nameAr : m.nameEn}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* main area by phase */}
        {state.completed ? (
          <Completed state={state} lang={lang} />
        ) : state.phase === "closed" ? (
          <HuntOver state={state} lang={lang} />
        ) : (
          <>
            {state.phase !== "open" && (
              <div className="panel p-4 border-gold/40">
                <p className="text-goldbright font-semibold">{t.waitingTitle[lang]}</p>
                <p className="text-muted text-sm mt-1">{t.waitingBody[lang]}</p>
              </div>
            )}
            {state.phase === "open" && <HuntScanner lang={lang} />}
            {state.clue && (
              <div className="panel p-6 flex flex-col gap-4">
                <div>
                  <span className="text-muted text-xs uppercase tracking-widest">
                    {lang === "ar" ? "تبحث عن" : "You're looking for"}
                  </span>
                  <p className="text-2xl font-bold text-[#ff8c33] mt-1">
                    🎯 {lang === "ar" ? state.clue.nameAr : state.clue.nameEn}
                  </p>
                </div>
                <span className="text-muted text-xs uppercase tracking-widest border-t border-line pt-3">
                  {t.yourClue[lang]}
                </span>
                <p className="text-xl leading-relaxed whitespace-pre-line display text-ink">
                  {lang === "ar" ? state.clue.ar : state.clue.en}
                </p>
                <p
                  className="text-muted text-sm whitespace-pre-line border-t border-line pt-3"
                  dir={lang === "ar" ? "ltr" : "rtl"}
                >
                  {lang === "ar" ? state.clue.en : state.clue.ar}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {celebrate && (
        <ScanOverlay
          c={celebrate}
          lang={lang}
          onDismiss={() => setCelebrate(null)}
        />
      )}
    </main>
  );
}

function ScanOverlay({
  c,
  lang,
  onDismiss,
}: {
  c: Celebration;
  lang: Lang;
  onDismiss: () => void;
}) {
  const name = c.stationName ? (lang === "ar" ? c.stationName.ar : c.stationName.en) : "";
  const good = c.kind === "ok" || c.kind === "completed";
  const body =
    c.kind === "ok"
      ? c.early
        ? t.foundEarly[lang]
        : `${name} — ${c.found}/8`
      : c.kind === "completed"
      ? c.isWinner
        ? t.winner[lang]
        : t.finisher[lang]
      : c.kind === "already"
      ? t.alreadyFound[lang]
      : c.kind === "wrong_order"
      ? t.wrongOrder[lang]
      : c.kind === "not_open"
      ? t.notOpen[lang]
      : c.kind === "over"
      ? t.over[lang]
      : t.invalid[lang];

  return (
    <div
      dir={dirOf(lang)}
      onClick={onDismiss}
      className={`fixed inset-0 z-50 verdict-enter flex flex-col items-center justify-center gap-4 px-8 text-center ${
        good ? "bg-[#0d2b1c]" : (c.kind === "already" || c.kind === "wrong_order") ? "bg-[#3d3413]" : "bg-[#3a1016]"
      }`}
    >
      <span className="text-7xl">
        {c.kind === "completed" ? "☠️" : good ? "🏴‍☠️" : (c.kind === "already" || c.kind === "wrong_order") ? "⚠️" : "✕"}
      </span>
      <h2 className="text-3xl text-goldbright display">
        {c.kind === "completed"
          ? t.completeTitle[lang]
          : c.kind === "ok"
          ? `${t.found[lang]} ${name}`
          : ""}
      </h2>
      {c.kind === "ok" && (
        <p className="stat-value text-5xl font-bold text-goldbright">{c.found}/8</p>
      )}
      {c.kind === "completed" && c.placement && (
        <p className="stat-value text-6xl font-bold text-goldbright">#{c.placement}</p>
      )}
      <p className="text-lg max-w-xs">{body}</p>
      <p className="text-muted text-xs mt-4">
        {lang === "ar" ? "اضغط للمتابعة" : "tap to continue"}
      </p>
    </div>
  );
}

function Completed({ state, lang }: { state: State; lang: Lang }) {
  const c = state.completed!;
  return (
    <div className="panel p-8 flex flex-col items-center gap-4 text-center border-gold">
      <span className="text-6xl">☠️</span>
      <h1 className="text-3xl text-goldbright">{t.completeTitle[lang]}</h1>
      <p className="stat-value text-5xl font-bold text-goldbright">#{c.placement}</p>
      <p className="text-muted text-sm">
        {t.finishedAs[lang]} #{c.placement} · {c.minutes} min
      </p>
      <p
        className={`text-lg font-semibold ${
          c.isWinner ? "text-creedbright" : "text-ink"
        }`}
      >
        {c.isWinner ? `🗝 ${t.winner[lang]}` : t.finisher[lang]}
      </p>
      {state.leaderboard && state.leaderboard.length > 0 && (
        <Leaderboard entries={state.leaderboard} lang={lang} />
      )}
    </div>
  );
}

function HuntOver({ state, lang }: { state: State; lang: Lang }) {
  return (
    <div className="panel p-6 flex flex-col items-center gap-4 text-center">
      <span className="text-5xl">⚓</span>
      <h1 className="text-2xl text-goldbright">{t.over[lang]}</h1>
      {state.leaderboard && state.leaderboard.length > 0 && (
        <Leaderboard entries={state.leaderboard} lang={lang} />
      )}
      <p className="text-muted text-sm">{t.thanks[lang]}</p>
    </div>
  );
}

function Leaderboard({
  entries,
  lang,
}: {
  entries: Array<{ name: string; placement: number }>;
  lang: Lang;
}) {
  return (
    <div className="w-full">
      <h2 className="text-sm text-muted uppercase tracking-widest mb-2">
        {t.leaderboard[lang]}
      </h2>
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
        {entries.map((e) => (
          <div
            key={e.placement}
            className="flex items-center justify-between bg-panel2 rounded px-3 py-1.5 text-sm"
          >
            <span className="stat-value text-goldbright font-bold">#{e.placement}</span>
            <span>{e.name}</span>
            <span>{e.placement <= 3 ? ["🥇", "🥈", "🥉"][e.placement - 1] : "🏴‍☠️"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
