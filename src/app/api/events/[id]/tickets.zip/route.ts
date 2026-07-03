import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { renderTicketPng } from "@/lib/ticketRender";

export const maxDuration = 300;

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
    include: {
      tickets: {
        where: { status: { in: ["VALID", "CHECKED_IN"] } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const zip = new JSZip();
  // render in small batches to keep memory sane
  const batch = 8;
  for (let i = 0; i < event.tickets.length; i += batch) {
    const chunk = event.tickets.slice(i, i + batch);
    const pngs = await Promise.all(
      chunk.map((t) => renderTicketPng(t, event))
    );
    chunk.forEach((t, j) => {
      const name = `${t.tier === "VIP" ? "VIP" : "NORMAL"}/${t.shortCode}${
        t.holderName ? "-" + t.holderName.replace(/[^a-z0-9]/gi, "_") : ""
      }.png`;
      zip.file(name, pngs[j]);
    });
  }

  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${event.name.replace(/[^a-z0-9]/gi, "_")}-tickets.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
