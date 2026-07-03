import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { renderStationPoster } from "@/lib/posterRender";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;
  const station = await db.huntStation.findUnique({ where: { id } });
  if (!station) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "localhost:3000";
  const scanUrl = `${proto}://${host}/s/${station.slug}?t=${station.token}`;

  const png = await renderStationPoster(station, scanUrl);
  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="hunt-poster-${station.slug}.png"`,
      "Cache-Control": "no-store",
    },
  });
}
