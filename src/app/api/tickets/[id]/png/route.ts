import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { renderTicketPng } from "@/lib/ticketRender";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;
  const ticket = await db.ticket.findUnique({
    where: { id },
    include: { event: true },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const png = await renderTicketPng(ticket, ticket.event);
  const name = `${ticket.shortCode}${ticket.holderName ? "-" + ticket.holderName.replace(/[^a-z0-9]/gi, "_") : ""}.png`;

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
