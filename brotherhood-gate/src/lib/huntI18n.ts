// Player-facing strings, AR primary / EN secondary. Client-safe module.

export type Lang = "ar" | "en";

export const t = {
  title: { ar: "كنز الأخوية", en: "THE HUNT BEGINS" },
  subtitle: {
    ar: "٨ علامات · ٣ طوابق · ٣٠ دقيقة",
    en: "8 marks · 3 floors · 30 minutes",
  },
  fullName: { ar: "الاسم الكامل", en: "Full name" },
  phone: { ar: "رقم الهاتف (اختياري — للجائزة)", en: "Phone (optional — for prize contact)" },
  start: { ar: "ابدأ الرحلة", en: "START" },
  registering: { ar: "جارٍ التسجيل…", en: "Registering…" },
  rulesTitle: { ar: "القواعد", en: "The Rules" },
  rules: {
    ar: [
      "امشِ ولا تركض — احترم المحلات والزوار.",
      "علاماتك خاصة بك: لكل صياد طريق مختلف.",
      "المسح يُقبل فقط بين ٧:٣٠ و ٨:٠٠ مساءً.",
      "أول من يجمع ٨/٨ يفوز بمفتاح لعبة — وكل من يُكمل يحصل على جائزة.",
      "الجوائز تُستلم من منصة السينما، الطابق الثالث.",
      "هاتف واحد لكل لاعب — تقدمك مرتبط بهذا الهاتف.",
    ],
    en: [
      "Walk, don't run — respect shops and shoppers.",
      "Your clues are YOURS: every hunter has a different route.",
      "Scans count only between 7:30 and 8:00 PM.",
      "First to 8/8 win a game key — every finisher gets a reward.",
      "Prizes: cinema forecourt desk, 3rd floor.",
      "One phone per player — your progress lives on this phone.",
    ],
  },
  yourClue: { ar: "دليلك الحالي", en: "YOUR CURRENT CLUE" },
  progress: { ar: "العلامات", en: "MARKS" },
  hint: { ar: "تلميح", en: "Hint" },
  hintFloor: { ar: "الطابق:", en: "Floor:" },
  hintLocked: { ar: "التلميح يفتح بعد ٣ دقائق", en: "Hint unlocks after 3 min" },
  keysClaimed: { ar: "مفاتيح مطالب بها", en: "keys claimed" },
  waitingTitle: { ar: "استعد…", en: "Get ready…" },
  waitingBody: {
    ar: "الصيد يبدأ الساعة ٧:٣٠. هذا دليلك الأول — يمكنك البحث عن مكانه الآن!",
    en: "Scanning opens at 7:30 PM. Here's your first clue — you can start looking now!",
  },
  found: { ar: "وجدتها!", en: "FOUND!" },
  foundEarly: {
    ar: "وجدتها مبكرًا! دليلك الحالي ما زال ينتظر.",
    en: "Found early! Your current clue still awaits.",
  },
  alreadyFound: { ar: "وجدت هذه من قبل", en: "Already found this one" },
  nextClue: { ar: "الدليل التالي", en: "Next clue" },
  notOpen: { ar: "الصيد لم يبدأ بعد", en: "The hunt hasn't started yet" },
  over: { ar: "انتهى الصيد", en: "The hunt is over" },
  invalid: { ar: "هذا ليس رمز الكنز", en: "Not a hunt code" },
  completeTitle: { ar: "X تُحدد مكان الكنز", en: "X MARKS THE SPOT" },
  finishedAs: { ar: "أنهيت في المركز", en: "You finished" },
  winner: {
    ar: "فائز! استلم مفتاح لعبتك من منصة السينما — الطابق الثالث.",
    en: "WINNER! Claim your game key at the cinema desk — 3rd floor.",
  },
  finisher: {
    ar: "كل المفاتيح مُطالب بها — استلم جائزتك من المنصة، الطابق الثالث.",
    en: "All keys claimed — collect your reward at the desk, 3rd floor.",
  },
  leaderboard: { ar: "لوحة الصدارة", en: "Final Leaderboard" },
  thanks: {
    ar: "شكرًا لمشاركتك! اللعبة تصدر غدًا.",
    en: "Thanks for hunting! The game releases tomorrow.",
  },
  registerFirst: {
    ar: "سجّل اسمك أولًا لبدء الصيد — سنحسب لك هذه العلامة.",
    en: "Enter your name first — we'll credit this mark once you register.",
  },
  nameRequired: { ar: "أدخل اسمك الكامل", en: "Enter your full name" },
  networkError: { ar: "خطأ في الاتصال — حاول مرة أخرى", en: "Network error — try again" },
  wrongOrder: {
    ar: "ترتيب خاطئ! يجب أن تجد العلامات بالترتيب.",
    en: "Wrong order! You must find the marks in the correct sequence.",
  },
} as const;

export function dirOf(lang: Lang): "rtl" | "ltr" {
  return lang === "ar" ? "rtl" : "ltr";
}
