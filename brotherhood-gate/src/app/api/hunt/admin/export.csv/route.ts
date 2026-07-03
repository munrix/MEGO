import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

function cell(v: string | null | undefined): string {
  if (!v) return "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET() {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const players = await db.huntPlayer.findMany({
    orderBy: [{ placement: "asc" }, { registeredAt: "asc" }],
    include: {
      scans: {
        orderBy: { scannedAt: "asc" },
        include: { station: { select: { slug: true } } },
      },
    },
  });

  const rows = [
    "full_name,phone,registered_at,marks_found,completed_at,placement,flagged,flag_reason,key_given_at,scan_trail",
    ...players.map((p) =>
      [
        cell(p.fullName),
        cell(p.phone),
        p.registeredAt.toISOString(),
        String(p.scans.length),
        p.completedAt?.toISOString() ?? "",
        p.placement?.toString() ?? "",
        p.flagged ? "YES" : "",
        cell(p.flagReason),
        p.keyGivenAt?.toISOString() ?? "",
        cell(
          p.scans
            .map((s) => `${s.station.slug}@${s.scannedAt.toISOString().slice(11, 19)}`)
            .join(" > ")
        ),
      ].join(",")
    ),
  ].join("\n");

  return new NextResponse(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="treasure-hunt-players.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
