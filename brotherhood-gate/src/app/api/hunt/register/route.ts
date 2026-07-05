import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import {
  createHuntSession,
  generateRoute,
  getHuntConfig,
  getHuntPlayerId,
  huntPhase,
  processScan,
  PENDING_COOKIE,
} from "@/lib/hunt";

// per-IP registration limit: 5 / 10 min (multi-register from one phone is
// pointless anyway — the session cookie is the identity)
const regHits = new Map<string, { count: number; resetAt: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const e = regHits.get(ip);
  if (!e || now > e.resetAt) {
    regHits.set(ip, { count: 1, resetAt: now + 10 * 60_000 });
    return false;
  }
  return ++e.count > 5;
}

export async function POST(req: NextRequest) {
  const cfg = await getHuntConfig();
  const phase = huntPhase(cfg);
  if (phase === "before_registration") {
    return NextResponse.json({ error: "not_open" }, { status: 403 });
  }
  if (phase === "closed") {
    return NextResponse.json({ error: "over" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.fullName ?? "").trim().slice(0, 80);
  const phone = String(body.phone ?? "").trim().slice(0, 30) || null;
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  // Check for already registered on this phone / session
  const existing = await getHuntPlayerId();
  let existingPlayer = null;

  if (existing) {
    existingPlayer = await db.huntPlayer.findUnique({ where: { id: existing } });
  }
  if (!existingPlayer && phone) {
    existingPlayer = await db.huntPlayer.findFirst({ where: { phone } });
  }

  if (existingPlayer) {
    await createHuntSession(existingPlayer.id);

    const jarPending = req.cookies.get(PENDING_COOKIE)?.value;
    let credited = false;
    let stationNameEn = "";
    let stationNameAr = "";
    if (jarPending) {
      const [slug, token] = jarPending.split("|");
      if (slug && token) {
        const outcome = await processScan(existingPlayer.id, slug.toLowerCase(), token, {
          userAgent,
          ip,
        });
        credited = outcome.kind === "ok" || outcome.kind === "completed";
        if (credited && "stationName" in outcome) {
          stationNameEn = outcome.stationName.en;
          stationNameAr = outcome.stationName.ar;
        }
      }
    }

    const res = NextResponse.json({ ok: true, resumed: true, credited, stationNameEn, stationNameAr });
    res.cookies.delete(PENDING_COOKIE);
    return res;
  }

  if (fullName.length < 3) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  // Determine starter station (first scan, or Havana as fallback)
  const jarPending = req.cookies.get(PENDING_COOKIE)?.value;
  let firstStationSlug = "havana";
  if (jarPending) {
    const [slug] = jarPending.split("|");
    if (slug) firstStationSlug = slug.toLowerCase();
  }

  const stations = await db.huntStation.findMany({ where: { active: true } });
  const firstStation = stations.find((s) => s.slug === firstStationSlug) || stations[0];
  const saltKey = stations.find((s) => s.slug === "salt-key");

  // Filter out the first station and final salt-key station
  const otherStations = stations.filter((s) => s.id !== firstStation.id && (!saltKey || s.id !== saltKey.id));
  
  // Shuffle intermediate stations
  const shuffledOthers = generateRoute(
    otherStations.map((s) => s.id),
    null
  );

  const route = [firstStation.id, ...shuffledOthers];
  if (saltKey && firstStation.id !== saltKey.id) {
    route.push(saltKey.id);
  }

  const player = await db.huntPlayer.create({
    data: {
      fullName,
      phone,
      sessionToken: crypto.randomBytes(24).toString("base64url"),
      route: JSON.stringify(route),
      ip,
      userAgent,
    },
  });
  await createHuntSession(player.id);

  // Credit the pending first scan
  let credited = false;
  let stationNameEn = "";
  let stationNameAr = "";
  if (jarPending) {
    const [slug, token] = jarPending.split("|");
    if (slug && token) {
      const outcome = await processScan(player.id, slug.toLowerCase(), token, {
        userAgent,
        ip,
      });
      credited = outcome.kind === "ok" || outcome.kind === "completed";
      if (credited && "stationName" in outcome) {
        stationNameEn = outcome.stationName.en;
        stationNameAr = outcome.stationName.ar;
      }
    }
  }

  const res = NextResponse.json({ ok: true, credited, stationNameEn, stationNameAr });
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
