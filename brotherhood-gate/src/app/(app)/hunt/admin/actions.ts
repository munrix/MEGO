"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/session";
import { audit } from "@/lib/audit";

const PATH = "/hunt/admin";

export async function updateHuntConfig(formData: FormData) {
  const user = await requireAdmin();
  const parse = (name: string) => {
    const v = String(formData.get(name) ?? "");
    const d = new Date(v);
    if (isNaN(d.getTime())) throw new Error(`Bad date for ${name}`);
    return d;
  };
  await db.huntConfig.update({
    where: { id: 1 },
    data: {
      registrationAt: parse("registrationAt"),
      opensAt: parse("opensAt"),
      closesAt: parse("closesAt"),
      maxWinners: Math.max(1, parseInt(String(formData.get("maxWinners") || "15"), 10) || 15),
      requiredCount: Math.min(8, Math.max(1, parseInt(String(formData.get("requiredCount") || "8"), 10) || 8)),
      lenientMode: formData.get("lenientMode") === "on",
      killSwitch: formData.get("killSwitch") === "on",
    },
  });
  await audit(user.id, "HUNT_CONFIG_UPDATE");
  revalidatePath(PATH);
}

export async function toggleStation(stationId: string) {
  const user = await requireAdmin();
  const s = await db.huntStation.findUniqueOrThrow({ where: { id: stationId } });
  await db.huntStation.update({
    where: { id: stationId },
    data: { active: !s.active },
  });
  await audit(user.id, s.active ? "HUNT_STATION_DISABLE" : "HUNT_STATION_ENABLE", s.slug);
  revalidatePath(PATH);
}

export async function regenStationToken(stationId: string) {
  const user = await requireAdmin();
  const s = await db.huntStation.update({
    where: { id: stationId },
    data: { token: crypto.randomBytes(9).toString("base64url") },
  });
  await audit(user.id, "HUNT_STATION_TOKEN_REGEN", `${s.slug} — old posters are now dead`);
  revalidatePath(PATH);
}

export async function updateClue(formData: FormData) {
  const user = await requireAdmin();
  const stationId = String(formData.get("stationId"));
  const s = await db.huntStation.update({
    where: { id: stationId },
    data: {
      clueEn: String(formData.get("clueEn") ?? "").trim(),
      clueAr: String(formData.get("clueAr") ?? "").trim(),
    },
  });
  await audit(user.id, "HUNT_CLUE_UPDATE", s.slug);
  revalidatePath(PATH);
}

export async function giveKey(playerId: string) {
  const user = await requireUser(); // desk staff can do this
  const p = await db.huntPlayer.findUniqueOrThrow({ where: { id: playerId } });
  if (!p.completedAt) throw new Error("Player has not completed the hunt");
  if (p.keyGivenAt) return; // one-way, already given
  await db.huntPlayer.update({
    where: { id: playerId },
    data: { keyGivenAt: new Date(), keyGivenBy: user.id },
  });
  await audit(user.id, "HUNT_KEY_GIVEN", `${p.fullName} (#${p.placement})`);
  revalidatePath(PATH);
}

export async function clearFlag(playerId: string) {
  const user = await requireAdmin();
  const p = await db.huntPlayer.update({
    where: { id: playerId },
    data: { flagged: false, flagReason: null },
  });
  await audit(user.id, "HUNT_FLAG_CLEAR", p.fullName);
  revalidatePath(PATH);
}

export async function disqualify(playerId: string) {
  const user = await requireAdmin();
  const p = await db.huntPlayer.update({
    where: { id: playerId },
    data: { flagged: true, flagReason: "DISQUALIFIED" },
  });
  await audit(user.id, "HUNT_DISQUALIFY", p.fullName);
  revalidatePath(PATH);
}

export async function startHunt() {
  const user = await requireAdmin();
  const now = new Date();
  const registrationAt = new Date(now.getTime() - 5 * 60_000);
  const opensAt = now;
  const closesAt = new Date(now.getTime() + 60 * 60_000); // 1 hour default duration

  await db.huntConfig.update({
    where: { id: 1 },
    data: {
      registrationAt,
      opensAt,
      closesAt,
      killSwitch: false,
    },
  });
  await audit(user.id, "HUNT_START");
  revalidatePath(PATH);
}

export async function stopHunt() {
  const user = await requireAdmin();
  await db.huntConfig.update({
    where: { id: 1 },
    data: {
      killSwitch: true,
    },
  });
  await audit(user.id, "HUNT_STOP");
  revalidatePath(PATH);
}
