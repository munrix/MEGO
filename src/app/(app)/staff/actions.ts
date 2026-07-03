"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/session";
import { audit } from "@/lib/audit";

export async function createStaff(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string } | null> {
  const admin = await requireAdmin();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role")) === "ADMIN" ? "ADMIN" : "STAFF";

  if (!username || !name || password.length < 6) {
    return { error: "Fill all fields; passphrase needs 6+ characters." };
  }
  const existing = await db.user.findUnique({ where: { username } });
  if (existing) return { error: "That codename is taken." };

  await db.user.create({
    data: { username, name, role, password: await bcrypt.hash(password, 10) },
  });
  await audit(admin.id, "STAFF_CREATE", `${name} (${username}, ${role})`);
  revalidatePath("/staff");
  return null;
}

export async function toggleStaffActive(userId: string) {
  const admin = await requireAdmin();
  if (userId === admin.id) return; // can't deactivate yourself
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.user.update({
    where: { id: userId },
    data: { active: !user.active },
  });
  await audit(
    admin.id,
    user.active ? "STAFF_DEACTIVATE" : "STAFF_ACTIVATE",
    user.username
  );
  revalidatePath("/staff");
}

export async function resetStaffPassword(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return;
  const user = await db.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(password, 10) },
  });
  await audit(admin.id, "STAFF_PASSWORD_RESET", user.username);
  revalidatePath("/staff");
}
