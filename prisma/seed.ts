import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = await bcrypt.hash("mentor123", 10);
  await prisma.user.upsert({
    where: { username: "mentor" },
    update: {},
    create: {
      username: "mentor",
      password,
      name: "The Mentor",
      role: "ADMIN",
    },
  });
  console.log("Seeded admin: mentor / mentor123");
}

main().finally(() => prisma.$disconnect());
