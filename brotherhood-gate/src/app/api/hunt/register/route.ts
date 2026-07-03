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

  // already registered on this phone? just continue
  const existing = await getHuntPlayerId();
  if (existing) {
    const p = await db.huntPlayer.findUnique({ where: { id: existing } });
    if (p) return NextResponse.json({ ok: true, resumed: true });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const fullName = String(body.fullName ?? "").trim().slice(0, 80);
  const phone = String(body.phone ?? "").trim().slice(0, 30) || null;
  if (fullName.length < 3) {
    return NextResponse.json({ error: "name_required" }, { status: 400 });
  }

  const stations = await db.huntStation.findMany({ where: { active: true } });
  const saltKey = stations.find((s) => s.slug === "salt-key");
  const route = generateRoute(
    stations.map((s) => s.id),
    saltKey?.id ?? null
  );

  const player = await db.huntPlayer.create({
    data: {
      fullName,
      phone,
      sessionToken: crypto.randomBytes(24).toString("base64url"),
      route: JSON.stringify(route),
    },
  });
  await createHuntSession(player.id);

  // credit a station scan that arrived before registration
  const jarPending = req.cookies.get(PENDING_COOKIE)?.value;
  let credited = false;
  if (jarPending) {
    const [slug, token] = jarPending.split("|");
    if (slug && token) {
      const outcome = await processScan(player.id, slug, token, {
        userAgent: req.headers.get("user-agent") ?? undefined,
        ip,
      });
      credited = outcome.kind === "ok" || outcome.kind === "completed";
    }
  }

  const res = NextResponse.json({ ok: true, credited });
  res.cookies.delete(PENDING_COOKIE);
  return res;
}
