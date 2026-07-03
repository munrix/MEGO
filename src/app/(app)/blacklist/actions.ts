"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function addBlacklistEntry(formData: FormData) {
  const user = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const eventId = String(formData.get("eventId") ?? "") || null;
  if (!name) return;

  await db.blacklistEntry.create({ data: { name, phone, reason, eventId } });

  // auto-revoke live tickets held under this name (scoped if event-specific)
  const revoked = await db.ticket.updateMany({
    where: {
      holderName: name,
      status: "VALID",
      ...(eventId ? { eventId } : {}),
    },
    data: { status: "REVOKED" },
  });

  await audit(
    user.id,
    "BLACKLIST_ADD",
    `${name}${eventId ? ` (event-scoped)` : " (global)"} — ${revoked.count} ticket(s) auto-revoked`
  );
  revalidatePath("/blacklist");
}

export async function removeBlacklistEntry(id: string) {
  const user = await requireAdmin();
  const entry = await db.blacklistEntry.delete({ where: { id } });
  await audit(user.id, "BLACKLIST_REMOVE", entry.name);
  revalidatePath("/blacklist");
}
