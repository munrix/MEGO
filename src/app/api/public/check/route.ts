import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyTicketPayload } from "@/lib/ticketSign";

// naive in-memory rate limit per IP: 30 checks / 10 min
const hits = new Map<string, { count: number; resetAt: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  entry.count++;
  return entry.count > 30;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (limited(ip)) {
    return NextResponse.json(
      { valid: false, message: "Too many checks. Try again later." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const payload: string = String(body.payload ?? "");
  const code: string = String(body.code ?? "").trim().toUpperCase();

  let ticket = null;
  if (payload) {
    const ticketId = verifyTicketPayload(payload);
    if (ticketId) {
      ticket = await db.ticket.findUnique({
        where: { id: ticketId },
        include: { event: true },
      });
    }
  } else if (code) {
    ticket = await db.ticket.findUnique({
      where: { shortCode: code.startsWith("BF-") ? code : `BF-${code}` },
      include: { event: true },
    });
  }

  // deliberately minimal: no holder details, no reasons — just validity
  if (!ticket || ticket.status === "REVOKED" || ticket.status === "VOID") {
    return NextResponse.json({
      valid: false,
      message: "This ticket is not valid.",
    });
  }

  return NextResponse.json({
    valid: true,
    used: ticket.status === "CHECKED_IN",
    tier: ticket.tier,
    event: ticket.event.name,
    date: ticket.event.startsAt.toISOString(),
    message:
      ticket.status === "CHECKED_IN"
        ? "Valid ticket — already used for entry."
        : "Valid ticket. See you at the gate.",
  });
}
