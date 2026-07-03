"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Stats = {
  phase: string;
  players: number;
  finishers: number;
  winnersCount: number;
  maxWinners: number;
  ticker: Array<{ name: string; stationEn: string; stationAr: string }>;
  winners: Array<{ name: string; placement: number }>;
};

// Display-only page for the cinema big screen. No interaction, auto-refresh.
export default function BigScreen() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/hunt/stats")
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-between px-10 py-10 bg-cover bg-center relative overflow-hidden"
      style={{ backgroundImage: "url(/theme/bg-wide.jpg)" }}
    >
      <div className="absolute inset-0 bg-black/80" />
      <div className="relative flex flex-col items-center gap-2">
        <Image src="/theme/crest-white.png" alt="" width={90} height={90} />
        <h1 className="text-5xl text-goldbright display tracking-widest text-center">
          THE TREASURE HUNT
        </h1>
        <p className="text-muted text-xl" dir="rtl">كنز الأخوية</p>
      </div>

      {stats && (
        <>
          <div className="relative flex items-center gap-16">
            <div className="text-center">
              <p className="stat-value text-[7rem] leading-none font-bold text-goldbright">
                {stats.winnersCount}
                <span className="text-4xl text-muted">/{stats.maxWinners}</span>
              </p>
              <p className="text-xl uppercase tracking-[0.3em] text-muted mt-2">
                Keys Claimed · مفاتيح
              </p>
            </div>
            <div className="w-px h-32 bg-line" />
            <div className="text-center">
              <p className="stat-value text-[7rem] leading-none font-bold">
                {stats.players}
              </p>
              <p className="text-xl uppercase tracking-[0.3em] text-muted mt-2">
                Hunters · صيادون
              </p>
            </div>
          </div>

          {stats.winners.length > 0 && (
            <div className="relative flex gap-4 flex-wrap justify-center max-w-4xl">
              {stats.winners.map((w) => (
                <span key={w.placement} className="badge badge-vip text-xl px-5 py-2">
                  #{w.placement} {w.name}
                </span>
              ))}
            </div>
          )}

          {/* treasures-found ticker */}
          <div className="relative w-full overflow-hidden">
            <div className="flex gap-10 animate-[ticker_25s_linear_infinite] whitespace-nowrap text-2xl text-muted">
              {[...stats.ticker, ...stats.ticker].map((s, i) => (
                <span key={i}>
                  🏴‍☠️ <span className="text-ink">{s.name}</span> found{" "}
                  <span className="text-goldbright">{s.stationEn}</span>
                </span>
              ))}
            </div>
            <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }`}</style>
          </div>
        </>
      )}
    </main>
  );
}
