import { db } from "./db";

export async function audit(
  userId: string | null,
  action: string,
  detail?: string
) {
  try {
    await db.auditLog.create({ data: { userId, action, detail } });
  } catch {
    // audit failures must never break the main flow
  }
}
