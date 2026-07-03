import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

function csvCell(v: string | null | undefined): string {
  if (!v) return "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;
  const event = await db.event.findUnique({
    where: { id },
    include: { tickets: { orderBy: { createdAt: "asc" } } },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = [
    "short_code,tier,status,holder_name,holder_phone,holder_email,checked_in_at",
    ...event.tickets.map((t) =>
      [
        t.shortCode,
        t.tier,
        t.status,
        csvCell(t.holderName),
        csvCell(t.holderPhone),
        csvCell(t.holderEmail),
        t.checkedInAt?.toISOString() ?? "",
      ].join(",")
    ),
  ].join("\n");

  return new NextResponse(rows, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.name.replace(/[^a-z0-9]/gi, "_")}-attendees.csv"`,
    },
  });
}
