import { NextRequest, NextResponse } from "next/server";
import { getHuntPlayerId, processScan, PENDING_COOKIE } from "@/lib/hunt";

// Station poster QR target: https://<domain>/s/<slug>?t=<token>
// All game logic is server-side; this handler logs the scan and redirects
// into the app with a display-only outcome in the query string.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug.toLowerCase();
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const playerId = await getHuntPlayerId();

  if (!playerId) {
    // not registered yet — remember the scan, register, then credit it
    const url = req.nextUrl.clone();
    url.pathname = "/hunt";
    url.search = "?pending=1";
    const res = NextResponse.redirect(url);
    res.cookies.set(PENDING_COOKIE, `${slug}|${token}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 30,
    });
    return res;
  }

  const outcome = await processScan(playerId, slug, token, {
    userAgent: req.headers.get("user-agent") ?? undefined,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  const url = req.nextUrl.clone();
  url.pathname = "/hunt/play";
  const q = new URLSearchParams({ scan: outcome.kind });
  if ("stationName" in outcome) {
    q.set("sn", outcome.stationName.en);
    q.set("sa", outcome.stationName.ar);
  }
  if ("found" in outcome) q.set("f", String(outcome.found));
  if ("early" in outcome && outcome.early) q.set("early", "1");
  if (outcome.kind === "completed") {
    q.set("p", String(outcome.placement));
    q.set("w", outcome.isWinner ? "1" : "0");
  }
  url.search = `?${q.toString()}`;
  return NextResponse.redirect(url);
}
