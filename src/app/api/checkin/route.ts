import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { ticketId } = await req.json().catch(() => ({}));
  if (!ticketId) return NextResponse.json({ error: "Missing ticketId" }, { status: 400 });

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { event: { select: { name: true } } },
  });
  if (!ticket) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (ticket.status !== "VALID") {
    return NextResponse.json({ error: "Ticket is not in a valid state" }, { status: 409 });
  }

  await db.ticket.update({
    where: { id: ticketId },
    data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInBy: user.id },
  });
  await audit(
    user.id,
    "CHECKIN",
    `${ticket.holderName ?? "Bearer"} (${ticket.shortCode}) — ${ticket.event.name}`
  );

  return NextResponse.json({ ok: true });
}
