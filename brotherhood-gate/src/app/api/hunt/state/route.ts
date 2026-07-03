import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getHuntConfig, getHuntPlayerId, huntPhase, createHuntSession } from "@/lib/hunt";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cfg = await getHuntConfig();
  const phase = huntPhase(cfg);

  const winnersCount = await db.huntPlayer.count({
    where: { completedAt: { not: null }, placement: { lte: cfg.maxWinners } },
  });

  const base = {
    phase,
    serverTime: new Date().toISOString(),
    opensAt: cfg.opensAt.toISOString(),
    closesAt: cfg.closesAt.toISOString(),
    winnersCount,
    maxWinners: cfg.maxWinners,
    required: cfg.requiredCount,
  };

  let playerId = await getHuntPlayerId();

  if (!playerId) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    if (ip !== "unknown") {
      const restoredPlayer = await db.huntPlayer.findFirst({
        where: { ip, userAgent },
      });
      if (restoredPlayer) {
        playerId = restoredPlayer.id;
        await createHuntSession(restoredPlayer.id);
      }
    }
  }

  if (!playerId) return NextResponse.json({ ...base, registered: false });

  const player = await db.huntPlayer.findUnique({
    where: { id: playerId },
    include: { scans: { orderBy: { scannedAt: "asc" } } },
  });
  if (!player) return NextResponse.json({ ...base, registered: false });

  const stations = await db.huntStation.findMany({
    orderBy: { sortKey: "asc" },
  });
  const byId = new Map(stations.map((s) => [s.id, s]));
  const foundIds = new Set(player.scans.map((s) => s.stationId));
  const route: string[] = JSON.parse(player.route);
  const activeRoute = route.filter((id) => byId.get(id)?.active);
  const nextId = activeRoute.find((id) => !foundIds.has(id));
  const next = nextId ? byId.get(nextId) : null;

  // hint unlocks 3 min after the previous find (or registration)
  const lastAt =
    player.scans.length > 0
      ? player.scans[player.scans.length - 1].scannedAt.getTime()
      : player.registeredAt.getTime();
  const hintReady = Date.now() - lastAt > 3 * 60_000;

  // leaderboard once the hunt closes
  let leaderboard: Array<{ name: string; placement: number }> = [];
  if (phase === "closed") {
    const finishers = await db.huntPlayer.findMany({
      where: { completedAt: { not: null } },
      orderBy: { placement: "asc" },
      take: 30,
      select: { fullName: true, placement: true },
    });
    leaderboard = finishers.map((f) => ({
      name: f.fullName.split(/\s+/)[0],
      placement: f.placement!,
    }));
  }

  return NextResponse.json({
    ...base,
    registered: true,
    name: player.fullName,
    found: player.scans.map((s) => {
      const st = byId.get(s.stationId);
      return { slug: st?.slug, nameEn: st?.nameEn, nameAr: st?.nameAr };
    }),
    foundCount: foundIds.size,
    medallions: stations
      .filter((s) => s.active)
      .map((s) => ({
        slug: s.slug,
        nameEn: s.nameEn,
        nameAr: s.nameAr,
        lit: foundIds.has(s.id),
      })),
    clue: next
      ? {
          en: next.clueEn,
          ar: next.clueAr,
          hintFloor: hintReady ? next.floor : null,
          hintReady,
        }
      : null,
    completed: player.completedAt
      ? {
          at: player.completedAt.toISOString(),
          placement: player.placement,
          isWinner: (player.placement ?? Infinity) <= cfg.maxWinners,
          minutes: Math.round(
            (player.completedAt.getTime() - player.registeredAt.getTime()) / 60000
          ),
        }
      : null,
    leaderboard,
  });
}
