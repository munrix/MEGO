import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { verifyTicketPayload } from "@/lib/ticketSign";
import { audit } from "@/lib/audit";

export type ScanVerdict = {
  result: "OK" | "DUPLICATE" | "REVOKED" | "BLACKLISTED" | "INVALID" | "WRONG_EVENT" | "EVENT_CLOSED";
  ticket?: {
    id: string;
    shortCode: string;
    tier: string;
    status: string;
    holderName: string | null;
    checkedInAt: string | null;
    checkedInByName?: string | null;
  };
  checkedIn?: boolean;
  message: string;
};

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const payload: string = String(body.payload ?? "");
  const code: string = String(body.code ?? "").trim().toUpperCase();
  const eventId: string = String(body.eventId ?? "");
  const autoCheckIn: boolean = Boolean(body.autoCheckIn);

  let ticketId: string | null = null;
  if (payload) {
    ticketId = verifyTicketPayload(payload);
    if (!ticketId) {
      return NextResponse.json<ScanVerdict>({
        result: "INVALID",
        message: "Forged or unreadable mark. This is no Assassin.",
      });
    }
  }

  const ticket = ticketId
    ? await db.ticket.findUnique({ where: { id: ticketId }, include: { event: true } })
    : code
    ? await db.ticket.findUnique({ where: { shortCode: code.startsWith("BF-") ? code : `BF-${code}` }, include: { event: true } })
    : null;

  if (!ticket) {
    return NextResponse.json<ScanVerdict>({
      result: "INVALID",
      message: "No such ticket in our records.",
    });
  }

  const ticketInfo = async (): Promise<NonNullable<ScanVerdict["ticket"]>> => {
    let checkedInByName: string | null = null;
    if (ticket.checkedInBy) {
      const u = await db.user.findUnique({ where: { id: ticket.checkedInBy } });
      checkedInByName = u?.name ?? null;
    }
    return {
      id: ticket.id,
      shortCode: ticket.shortCode,
      tier: ticket.tier,
      status: ticket.status,
      holderName: ticket.holderName,
      checkedInAt: ticket.checkedInAt?.toISOString() ?? null,
      checkedInByName,
    };
  };

  const log = (result: string) =>
    db.scanLog.create({
      data: { ticketId: ticket.id, userId: user.id, result },
    });

  if (eventId && ticket.eventId !== eventId) {
    await log("WRONG_EVENT");
    return NextResponse.json<ScanVerdict>({
      result: "WRONG_EVENT",
      ticket: await ticketInfo(),
      message: `This ticket belongs to "${ticket.event.name}", not this event.`,
    });
  }

  if (ticket.event.status !== "OPEN") {
    await log("EVENT_CLOSED");
    return NextResponse.json<ScanVerdict>({
      result: "EVENT_CLOSED",
      ticket: await ticketInfo(),
      message: "The gates for this event are closed.",
    });
  }

  // Blacklist check by holder name (global or event-scoped)
  if (ticket.holderName) {
    const black = await db.blacklistEntry.findFirst({
      where: {
        name: ticket.holderName,
        OR: [{ eventId: null }, { eventId: ticket.eventId }],
      },
    });
    if (black) {
      await log("BLACKLISTED");
      return NextResponse.json<ScanVerdict>({
        result: "BLACKLISTED",
        ticket: await ticketInfo(),
        message: black.reason
          ? `Templar detected — ${black.reason}`
          : "This name is on the Templar list. Deny entry.",
      });
    }
  }

  if (ticket.status === "REVOKED" || ticket.status === "VOID") {
    await log("REVOKED");
    return NextResponse.json<ScanVerdict>({
      result: "REVOKED",
      ticket: await ticketInfo(),
      message: "This ticket was revoked by a Mentor.",
    });
  }

  if (ticket.status === "CHECKED_IN") {
    await log("DUPLICATE");
    return NextResponse.json<ScanVerdict>({
      result: "DUPLICATE",
      ticket: await ticketInfo(),
      message: "Already inside. Possible ticket copy.",
    });
  }

  // VALID
  let checkedIn = false;
  if (autoCheckIn) {
    await db.ticket.update({
      where: { id: ticket.id },
      data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInBy: user.id },
    });
    checkedIn = true;
    await audit(
      user.id,
      "CHECKIN",
      `${ticket.holderName ?? "Bearer"} (${ticket.shortCode}) — ${ticket.event.name}`
    );
  }
  await log("OK");

  return NextResponse.json<ScanVerdict>({
    result: "OK",
    ticket: {
      ...(await ticketInfo()),
      status: checkedIn ? "CHECKED_IN" : "VALID",
    },
    checkedIn,
    message: checkedIn ? "Welcome, Brother. Entry granted." : "Valid ticket.",
  });
}
