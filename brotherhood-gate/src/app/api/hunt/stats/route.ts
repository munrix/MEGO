import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHuntConfig, huntPhase } from "@/lib/hunt";

export const dynamic = "force-dynamic";

// public read-only stats for the big screen — no personal data beyond first names
export async function GET() {
  const cfg = await getHuntConfig();
  const [players, finishers, recentScans, recentFinishers] = await Promise.all([
    db.huntPlayer.count(),
    db.huntPlayer.count({ where: { completedAt: { not: null } } }),
    db.huntScan.findMany({
      orderBy: { scannedAt: "desc" },
      take: 10,
      include: {
        player: { select: { fullName: true } },
        station: { select: { nameEn: true, nameAr: true } },
      },
    }),
    db.huntPlayer.findMany({
      where: { completedAt: { not: null } },
      orderBy: { placement: "asc" },
      take: 10,
      select: { fullName: true, placement: true },
    }),
  ]);

  return NextResponse.json({
    phase: huntPhase(cfg),
    players,
    finishers,
    winnersCount: Math.min(finishers, cfg.maxWinners),
    maxWinners: cfg.maxWinners,
    ticker: recentScans.map((s) => ({
      name: s.player.fullName.split(/\s+/)[0],
      stationEn: s.station.nameEn,
      stationAr: s.station.nameAr,
    })),
    winners: recentFinishers.map((f) => ({
      name: f.fullName.split(/\s+/)[0],
      placement: f.placement,
    })),
  });
}
