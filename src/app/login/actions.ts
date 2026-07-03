"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSession, destroySession, type SessionUser } from "@/lib/session";
import { audit } from "@/lib/audit";

const attempts = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return false;
  }
  entry.count++;
  return entry.count > 10;
}

export async function login(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string }> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: "Enter your credentials." };
  if (rateLimited(username))
    return { error: "Too many attempts. Wait a few minutes." };

  const user = await db.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.password))) {
    return { error: "The Creed does not recognize you." };
  }

  const sessionUser: SessionUser = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role as SessionUser["role"],
  };
  await createSession(sessionUser);
  await audit(user.id, "LOGIN");
  redirect("/dashboard");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
