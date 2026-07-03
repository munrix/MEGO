"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { t, dirOf } from "@/lib/huntI18n";
import { useLang, LangToggle } from "@/components/hunt/lang";

function RegisterInner() {
  const [lang, setLang] = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const pendingScan = params.get("pending") === "1";

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // already registered on this phone? skip straight to the game
  useEffect(() => {
    fetch("/api/hunt/state")
      .then((r) => r.json())
      .then((s) => {
        if (s.registered) router.replace("/hunt/play");
      })
      .catch(() => {});
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (fullName.trim().length < 3) {
      setError(t.nameRequired[lang]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/hunt/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone }),
      });
      const data = await res.json();
      if (data.ok) {
        if (data.credited) {
          router.replace(`/hunt/play?scan=ok&sn=${encodeURIComponent(data.stationNameEn)}&sa=${encodeURIComponent(data.stationNameAr)}&f=1`);
        } else {
          router.replace("/hunt/play");
        }
        return;
      }
      setError(
        data.error === "not_open"
          ? t.notOpen[lang]
          : data.error === "over"
          ? t.over[lang]
          : t.networkError[lang]
      );
    } catch {
      setError(t.networkError[lang]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main
      dir={dirOf(lang)}
      className="min-h-dvh flex flex-col items-center px-6 py-8 bg-cover bg-center relative"
      style={{ backgroundImage: "url(/theme/bg-login.jpg)" }}
    >
      <div className="absolute inset-0 bg-black/75" />
      <div className="relative w-full max-w-sm flex flex-col items-center gap-6">
        <div className="w-full flex justify-end">
          <LangToggle lang={lang} onChange={setLang} />
        </div>

        <Image
          src="/theme/crest-white.png"
          alt=""
          width={72}
          height={72}
          priority
          className="drop-shadow-[0_2px_16px_rgba(0,0,0,0.9)]"
        />
        <div className="text-center">
          <h1 className="text-3xl text-goldbright">{t.title[lang]}</h1>
          <p className="text-muted mt-1">{t.subtitle[lang]}</p>
        </div>

        {pendingScan && (
          <p className="panel px-4 py-3 text-sm text-goldbright text-center w-full">
            {t.registerFirst[lang]}
          </p>
        )}

        <form onSubmit={submit} className="panel w-full p-5 bg-black/60! backdrop-blur-sm flex flex-col gap-4">
          <div>
            <label className="field">{t.fullName[lang]}</label>
            <input
              className="input text-lg"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              required
              minLength={3}
            />
          </div>
          <div>
            <label className="field">{t.phone[lang]}</label>
            <input
              className="input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
            />
          </div>
          {error && <p className="text-bloodbright text-sm text-center">{error}</p>}
          <button className="btn btn-gold w-full text-lg py-3.5" disabled={busy}>
            {busy ? t.registering[lang] : `⚔️ ${t.start[lang]}`}
          </button>
        </form>

        <div className="panel w-full p-4">
          <h2 className="text-sm text-goldbright uppercase tracking-widest mb-2">
            {t.rulesTitle[lang]}
          </h2>
          <ul className="text-sm text-muted flex flex-col gap-1.5 list-disc ps-5">
            {t.rules[lang].map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </main>
  );
}

export default function HuntRegister() {
  return (
    <Suspense>
      <RegisterInner />
    </Suspense>
  );
}
