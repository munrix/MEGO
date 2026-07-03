"use client";

import { useEffect, useState } from "react";
import type { Lang } from "@/lib/huntI18n";

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLang] = useState<Lang>("ar");
  useEffect(() => {
    const saved = localStorage.getItem("hunt_lang");
    if (saved === "en" || saved === "ar") setLang(saved);
  }, []);
  const set = (l: Lang) => {
    setLang(l);
    localStorage.setItem("hunt_lang", l);
  };
  return [lang, set];
}

export function LangToggle({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (l: Lang) => void;
}) {
  return (
    <button
      onClick={() => onChange(lang === "ar" ? "en" : "ar")}
      className="badge badge-muted cursor-pointer select-none text-sm px-3 py-1"
    >
      {lang === "ar" ? "English" : "العربية"}
    </button>
  );
}
