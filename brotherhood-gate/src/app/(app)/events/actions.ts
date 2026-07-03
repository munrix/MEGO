"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";
import { generateShortCode } from "@/lib/ticketSign";

export async function createEvent(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  let user;
  try {
    user = await requireAdmin();
  } catch {
    return { error: "Only Mentors can create events." };
  }
  const name = String(formData.get("name") ?? "").trim();
  const venue = String(formData.get("venue") ?? "").trim();
  const startsAtRaw = String(formData.get("startsAt") ?? "");
  const startsAt = new Date(startsAtRaw);
  const capacityNormal = parseInt(String(formData.get("capacityNormal") || "0"), 10) || 0;
  const capacityVip = parseInt(String(formData.get("capacityVip") || "0"), 10) || 0;

  if (!name) return { error: "Give the event a name." };
  if (!venue) return { error: "Where is it happening? Add a venue." };
  if (!startsAtRaw || isNaN(startsAt.getTime()))
    return { error: "Pick a valid date and time." };

  const event = await db.event.create({
    data: { name, venue, startsAt, capacityNormal, capacityVip },
  });
  await audit(user.id, "EVENT_CREATE", `${event.name} (${event.id})`);
  redirect(`/events/${event.id}`);
}

export async function updateEventStatus(eventId: string, status: string) {
  const user = await requireAdmin();
  if (!["OPEN", "CLOSED", "ARCHIVED"].includes(status)) throw new Error("Bad status");
  const event = await db.event.update({ where: { id: eventId }, data: { status } });
  await audit(user.id, `EVENT_${status}`, `${event.name} (${event.id})`);
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  revalidatePath("/dashboard");
}

export async function generateTickets(formData: FormData) {
  const user = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const tier = String(formData.get("tier")) === "VIP" ? "VIP" : "NORMAL";
  const count = Math.min(Math.max(parseInt(String(formData.get("count") || "1"), 10) || 1, 1), 1000);
  const holderName = String(formData.get("holderName") ?? "").trim() || null;
  const holderPhone = String(formData.get("holderPhone") ?? "").trim() || null;
  const holderEmail = String(formData.get("holderEmail") ?? "").trim() || null;

  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });

  for (let i = 0; i < count; i++) {
    // retry on the astronomically unlikely shortCode collision
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await db.ticket.create({
          data: {
            eventId,
            tier,
            shortCode: generateShortCode(),
            holderName: count === 1 ? holderName : null,
            holderPhone: count === 1 ? holderPhone : null,
            holderEmail: count === 1 ? holderEmail : null,
          },
        });
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
  }

  await audit(user.id, "TICKETS_GENERATE", `${count}x ${tier} for ${event.name}`);
  revalidatePath(`/events/${eventId}`);
}

export async function importTicketsCsv(formData: FormData) {
  const user = await requireAdmin();
  const eventId = String(formData.get("eventId"));
  const csv = String(formData.get("csv") ?? "").trim();
  const defaultTier = String(formData.get("tier")) === "VIP" ? "VIP" : "NORMAL";
  if (!csv) return;

  const event = await db.event.findUniqueOrThrow({ where: { id: eventId } });

  const lines = csv.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  let imported = 0;
  for (const line of lines) {
    const [name, phone, email, tierRaw] = line
      .split(",")
      .map((s) => s?.trim().replace(/^"|"$/g, "").trim());
    if (!name || name.toLowerCase() === "name") continue; // skip header row
    const tier = tierRaw?.toUpperCase() === "VIP" ? "VIP" : defaultTier;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        await db.ticket.create({
          data: {
            eventId,
            tier,
            shortCode: generateShortCode(),
            holderName: name,
            holderPhone: phone || null,
            holderEmail: email || null,
          },
        });
        imported++;
        break;
      } catch (e) {
        if (attempt === 4) throw e;
      }
    }
  }

  await audit(user.id, "TICKETS_IMPORT", `${imported} rows for ${event.name}`);
  revalidatePath(`/events/${eventId}`);
}

export async function assignHolder(formData: FormData) {
  await requireAdmin();
  const ticketId = String(formData.get("ticketId"));
  const holderName = String(formData.get("holderName") ?? "").trim() || null;
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { holderName },
  });
  revalidatePath(`/events/${ticket.eventId}`);
}

export async function revokeTicket(ticketId: string) {
  const user = await requireAdmin();
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { status: "REVOKED" },
  });
  await audit(user.id, "TICKET_REVOKE", `${ticket.shortCode}`);
  revalidatePath(`/events/${ticket.eventId}`);
}

export async function restoreTicket(ticketId: string) {
  const user = await requireAdmin();
  const ticket = await db.ticket.update({
    where: { id: ticketId },
    data: { status: "VALID" },
  });
  await audit(user.id, "TICKET_RESTORE", `${ticket.shortCode}`);
  revalidatePath(`/events/${ticket.eventId}`);
}

export async function manualCheckIn(ticketId: string) {
  const user = await requireUser();
  const ticket = await db.ticket.findUniqueOrThrow({
    where: { id: ticketId },
    include: { event: { select: { name: true } } },
  });
  if (ticket.status !== "VALID") throw new Error("Ticket not valid");
  await db.ticket.update({
    where: { id: ticketId },
    data: { status: "CHECKED_IN", checkedInAt: new Date(), checkedInBy: user.id },
  });
  await db.scanLog.create({
    data: { ticketId, userId: user.id, result: "OK" },
  });
  await audit(
    user.id,
    "MANUAL_CHECKIN",
    `${ticket.holderName ?? "Bearer"} (${ticket.shortCode}) — ${ticket.event.name}`
  );
  revalidatePath(`/events/${ticket.eventId}`);
}

export async function undoCheckIn(ticketId: string) {
  const user = await requireUser();
  const ticket = await db.ticket.findUniqueOrThrow({ where: { id: ticketId } });
  if (ticket.status !== "CHECKED_IN") return;
  await db.ticket.update({
    where: { id: ticketId },
    data: { status: "VALID", checkedInAt: null, checkedInBy: null },
  });
  await audit(
    user.id,
    "CHECKIN_UNDO",
    `${ticket.holderName ?? "Bearer"} (${ticket.shortCode})`
  );
  revalidatePath(`/events/${ticket.eventId}`);
}

export async function deleteTicket(ticketId: string) {
  const user = await requireAdmin();
  const ticket = await db.ticket.delete({
    where: { id: ticketId },
  });
  await audit(
    user.id,
    "TICKET_DELETE",
    `${ticket.shortCode} (${ticket.holderName ?? "Bearer"})`
  );
  revalidatePath(`/events/${ticket.eventId}`);
}

export async function deleteEvent(eventId: string) {
  const user = await requireAdmin();
  // Clear eventId from blacklist entries referencing this event
  await db.blacklistEntry.updateMany({
    where: { eventId },
    data: { eventId: null },
  });
  const event = await db.event.delete({
    where: { id: eventId },
  });
  await audit(user.id, "EVENT_DELETE", `${event.name} (${event.id})`);
  revalidatePath("/dashboard");
  revalidatePath("/events");
  redirect("/dashboard");
}
