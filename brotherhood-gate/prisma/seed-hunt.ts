import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

const token = () => crypto.randomBytes(9).toString("base64url"); // 12 chars

// Clue texts are first drafts — edit them from the hunt admin page after
// walking the real poster positions with mall management.
const stations = [
  { slug: "havana", nameEn: "Havana", nameAr: "هافانا", floor: "Ground", sortKey: 1,
    clueEn: "Where the journey begins and voices meet —\nthe first mark waits by the grand entrance street.",
    clueAr: "حيث تبدأ الرحلة وتلتقي الأصوات —\nالعلامة الأولى تنتظر عند المدخل الكبير." },
  { slug: "nassau", nameEn: "Nassau", nameAr: "ناساو", floor: "Ground", sortKey: 2,
    clueEn: "A republic of pirates needs no king —\nfind the mark where the fountains sing.",
    clueAr: "جمهورية القراصنة لا تحتاج ملكًا —\nابحث عن العلامة حيث تغني النوافير." },
  { slug: "kingston", nameEn: "Kingston", nameAr: "كينغستون", floor: "Ground", sortKey: 3,
    clueEn: "Under the governor's watchful eye,\nthe mark hides where the palms stand high.",
    clueAr: "تحت عين الحاكم الساهرة،\nتختبئ العلامة حيث تقف النخيل العالية." },
  { slug: "great-inagua", nameEn: "Great Inagua", nameAr: "إيناغوا الكبرى", floor: "First", sortKey: 4,
    clueEn: "A captain's hideout, one floor above —\nseek the cove beside the moving stairs.",
    clueAr: "مخبأ القبطان في الطابق الأول —\nابحث عن الخليج بجانب السلالم المتحركة." },
  { slug: "tulum", nameEn: "Tulum", nameAr: "تولوم", floor: "First", sortKey: 5,
    clueEn: "Ancient walls keep secrets well —\nfind the mark where stories dwell.",
    clueAr: "الجدران القديمة تحفظ الأسرار جيدًا —\nابحث عن العلامة حيث تسكن الحكايات." },
  { slug: "tortuga", nameEn: "Tortuga", nameAr: "تورتوغا", floor: "Second", sortKey: 6,
    clueEn: "Where the crew feasts after the raid —\na hundred meals beneath one flag.",
    clueAr: "حيث يحتفل الطاقم بعد الغارة —\nمئة وجبة تحت راية واحدة." },
  { slug: "principe", nameEn: "Príncipe", nameAr: "برينسيبي", floor: "Second", sortKey: 7,
    clueEn: "A prince's isle of silver and gold —\nthe mark waits where treasures are sold.",
    clueAr: "جزيرة الأمير من فضة وذهب —\nالعلامة تنتظر حيث تُباع الكنوز." },
  { slug: "salt-key", nameEn: "Salt Key", nameAr: "سولت كي", floor: "Third", sortKey: 8,
    clueEn: "The final key lies salt and true —\nwhere moving pictures wait for you.",
    clueAr: "المفتاح الأخير صادق وأمين —\nحيث تنتظرك الصور المتحركة." },
];

async function main() {
  for (const s of stations) {
    await prisma.huntStation.upsert({
      where: { slug: s.slug },
      update: { nameEn: s.nameEn, nameAr: s.nameAr, floor: s.floor, sortKey: s.sortKey },
      create: { ...s, token: token() },
    });
  }

  // Event: July 8 2026, Baghdad (UTC+3) — reg 19:25, scans 19:30–20:00
  await prisma.huntConfig.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      registrationAt: new Date("2026-07-08T16:25:00Z"),
      opensAt: new Date("2026-07-08T16:30:00Z"),
      closesAt: new Date("2026-07-08T17:00:00Z"),
      maxWinners: 15,
      lenientMode: true,
      requiredCount: 8,
      killSwitch: false,
    },
  });

  console.log("Seeded 8 hunt stations + config (July 8, 19:25/19:30–20:00 Baghdad)");
}

main().finally(() => prisma.$disconnect());
