import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { db } from "./db";

const getSecret = () => {
  const secretStr =
    process.env.SESSION_SECRET ||
    "default-unsafe-session-secret-change-me-in-production";
  return new TextEncoder().encode(secretStr);
};

const COOKIE = "hunt_session";
export const PENDING_COOKIE = "hunt_pending";

// ── player session ────────────────────────────────────────────────────────

export async function createHuntSession(playerId: string) {
  const token = await new SignJWT({ pid: playerId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function getHuntPlayerId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return (payload.pid as string) ?? null;
  } catch {
    return null;
  }
}

// ── config ────────────────────────────────────────────────────────────────

export async function getHuntConfig() {
  const cfg = await db.huntConfig.findUnique({ where: { id: 1 } });
  if (!cfg) throw new Error("Hunt config missing — run prisma/seed-hunt.ts");
  return cfg;
}

export type HuntPhase = "before_registration" | "registration" | "open" | "closed";

export function huntPhase(cfg: {
  registrationAt: Date;
  opensAt: Date;
  closesAt: Date;
  killSwitch: boolean;
}): HuntPhase {
  const now = Date.now();
  if (cfg.killSwitch) return "closed";
  if (now < cfg.registrationAt.getTime()) return "before_registration";
  if (now < cfg.opensAt.getTime()) return "registration";
  if (now < cfg.closesAt.getTime()) return "open";
  return "closed";
}

// ── route generation ──────────────────────────────────────────────────────

export function generateRoute(stationIds: string[], saltKeyId: string | null): string[] {
  const pool = [...stationIds];
  // Fisher–Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  if (saltKeyId && pool.includes(saltKeyId)) {
    // ~50% of players end on Salt Key (3rd floor) so traffic drains toward
    // the redemption desk at the finish
    if (crypto.randomInt(2) === 0) {
      pool.splice(pool.indexOf(saltKeyId), 1);
      pool.push(saltKeyId);
    } else if (pool[0] === saltKeyId && pool.length > 1) {
      // never first — starts spread across the other 7 stations
      const j = 1 + crypto.randomInt(pool.length - 1);
      [pool[0], pool[j]] = [pool[j], pool[0]];
    }
  }
  return pool;
}

// ── scan processing (shared by station page + post-registration credit) ──

export type ScanOutcome =
  | { kind: "ok"; stationName: { en: string; ar: string }; found: number; required: number; early: boolean }
  | { kind: "completed"; placement: number; isWinner: boolean; found: number; required: number }
  | { kind: "already"; stationName: { en: string; ar: string }; found: number; required: number }
  | { kind: "wrong_order"; stationName: { en: string; ar: string } }
  | { kind: "not_open" }
  | { kind: "over" }
  | { kind: "invalid" };

// simple per-instance rate limit: 10 scan attempts / min / player
const scanHits = new Map<string, { count: number; resetAt: number }>();
function scanLimited(playerId: string): boolean {
  const now = Date.now();
  const entry = scanHits.get(playerId);
  if (!entry || now > entry.resetAt) {
    scanHits.set(playerId, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  return ++entry.count > 10;
}

export async function processScan(
  playerId: string,
  slug: string,
  stationToken: string,
  meta: { userAgent?: string; ip?: string }
): Promise<ScanOutcome> {
  const cfg = await getHuntConfig();
  const phase = huntPhase(cfg);
  if (phase === "before_registration" || phase === "registration")
    return { kind: "not_open" };
  if (phase === "closed") return { kind: "over" };

  if (scanLimited(playerId)) return { kind: "invalid" };

  const station = await db.huntStation.findUnique({ where: { slug } });
  if (!station || !station.active) return { kind: "invalid" };
  // constant-time-ish token check
  const a = Buffer.from(stationToken.padEnd(32).slice(0, 32));
  const b = Buffer.from(station.token.padEnd(32).slice(0, 32));
  if (!crypto.timingSafeEqual(a, b)) return { kind: "invalid" };

  const player = await db.huntPlayer.findUnique({
    where: { id: playerId },
    include: { scans: true },
  });
  if (!player || player.flagged === true && player.flagReason === "DISQUALIFIED")
    return { kind: "invalid" };

  const names = { en: station.nameEn, ar: station.nameAr };
  const alreadyIds = new Set(player.scans.map((s) => s.stationId));

  if (alreadyIds.has(station.id)) {
    return { kind: "already", stationName: names, found: alreadyIds.size, required: cfg.requiredCount };
  }

  // strict mode: only the current target station counts
  const route: string[] = JSON.parse(player.route);
  const nextTarget = route.find((id) => !alreadyIds.has(id));
  const early = station.id !== nextTarget;
  if (!cfg.lenientMode && early) {
    return { kind: "wrong_order", stationName: names };
  }

  await db.huntScan.create({
    data: {
      playerId,
      stationId: station.id,
      userAgent: meta.userAgent?.slice(0, 250),
      ip: meta.ip?.slice(0, 60),
    },
  });

  const found = alreadyIds.size + 1;

  // auto-flag: two scans on different floors < 45s apart
  const lastScan = player.scans.sort(
    (x, y) => y.scannedAt.getTime() - x.scannedAt.getTime()
  )[0];
  if (lastScan) {
    const lastStation = await db.huntStation.findUnique({ where: { id: lastScan.stationId } });
    if (
      lastStation &&
      lastStation.floor !== station.floor &&
      Date.now() - lastScan.scannedAt.getTime() < 45_000 &&
      !player.flagged
    ) {
      await db.huntPlayer.update({
        where: { id: playerId },
        data: { flagged: true, flagReason: `Cross-floor scan in <45s (${lastStation.slug}→${station.slug})` },
      });
    }
  }

  if (found < cfg.requiredCount) {
    return { kind: "ok", stationName: names, found, required: cfg.requiredCount, early };
  }

  // ── completion: atomic placement assignment ──────────────────────────
  const totalMs = Date.now() - player.registeredAt.getTime();
  const speedFlag = totalMs < 10 * 60 * 1000;

  let placement = 0;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      placement = await db.$transaction(async (tx) => {
        const finished = await tx.huntPlayer.count({
          where: { completedAt: { not: null } },
        });
        const p = finished + 1;
        await tx.huntPlayer.update({
          where: { id: playerId },
          data: {
            completedAt: new Date(),
            placement: p,
            ...(speedFlag && !player.flagged
              ? { flagged: true, flagReason: `Finished in ${Math.round(totalMs / 60000)} min (<10 min)` }
              : {}),
          },
        });
        return p;
      });
      break;
    } catch (e) {
      // unique(placement) collision from a simultaneous finisher — retry
      if (attempt === 4) throw e;
    }
  }

  return {
    kind: "completed",
    placement,
    isWinner: placement <= cfg.maxWinners,
    found,
    required: cfg.requiredCount,
  };
}
