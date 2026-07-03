import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { renderTicketPng } from "@/lib/ticketRender";

export const maxDuration = 300;

// A4 portrait, 2 portrait tickets side by side per page
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 30;
const TICKET_RATIO = 1300 / 760; // h / w

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
        orderBy: [{ tier: "desc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await PDFDocument.create();
  const ticketW = (PAGE_W - MARGIN * 3) / 2;
  const ticketH = ticketW * TICKET_RATIO;
  const perPage = 2;

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  let slot = 0;

  for (const t of event.tickets) {
    if (slot === perPage) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      slot = 0;
    }
    const png = await renderTicketPng(t, event);
    const img = await pdf.embedPng(png);
    const x = MARGIN + slot * (ticketW + MARGIN);
    const y = (PAGE_H - ticketH) / 2;
    page.drawImage(img, { x, y, width: ticketW, height: ticketH });
    slot++;
  }

  const bytes = await pdf.save();
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${event.name.replace(/[^a-z0-9]/gi, "_")}-tickets.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
