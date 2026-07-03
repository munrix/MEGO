import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const mentorPassword = await bcrypt.hash("mentor123", 10);
  await prisma.user.upsert({
    where: { username: "mentor" },
    update: {},
    create: {
      username: "mentor",
      password: mentorPassword,
      name: "The Mentor",
      role: "ADMIN",
    },
  });
  console.log("Seeded admin: mentor / mentor123");

  const munrixPassword = await bcrypt.hash("123", 10);
  await prisma.user.upsert({
    where: { username: "munrix" },
    update: {},
    create: {
      username: "munrix",
      password: munrixPassword,
      name: "munrix",
      role: "ADMIN",
    },
  });
  console.log("Seeded user: munrix / 123");
}

main().finally(() => prisma.$disconnect());
