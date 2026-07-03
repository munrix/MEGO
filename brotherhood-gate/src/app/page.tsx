import Image from "next/image";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Landing() {
  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-6 py-12 bg-cover bg-center relative"
      style={{ backgroundImage: "url(/theme/bg-wide.jpg)" }}
    >
      <div className="absolute inset-0 bg-black/78" />
      <div className="relative w-full max-w-md flex flex-col items-center gap-10">
        <div className="flex flex-col items-center gap-3">
          <Image
            src="/theme/mego-wordmark.png"
            alt="MEGO"
            width={280}
            height={72}
            priority
            className="rounded-lg shadow-[0_4px_24px_rgba(0,0,0,0.7)]"
          />
          <p className="text-muted text-sm tracking-[0.25em] uppercase">
            Black Flag Resynced · Launch Night
          </p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <Link
            href="/dashboard"
            className="panel p-6 flex items-center gap-5 hover:border-gold transition-colors group"
          >
            <span className="text-4xl">🎟️</span>
            <div className="flex-1">
              <h2 className="text-lg text-goldbright group-hover:text-goldbright">
                Ticket Command
              </h2>
              <p className="text-muted text-sm">
                Events, tickets, scanning &amp; check-in — staff only.
              </p>
            </div>
            <span className="text-muted group-hover:text-goldbright">→</span>
          </Link>

          <Link
            href="/hunt"
            className="panel p-6 flex items-center gap-5 hover:border-gold transition-colors group"
          >
            <span className="text-4xl">🗺️</span>
            <div className="flex-1">
              <h2 className="text-lg text-goldbright">Treasure Hunt</h2>
              <p className="text-muted text-sm">
                8 marks, 3 floors, 30 minutes. Anyone can play.
              </p>
              <p className="text-muted text-sm" dir="rtl">
                ٨ علامات، ٣ طوابق، ٣٠ دقيقة — الكل يلعب.
              </p>
            </div>
            <span className="text-muted group-hover:text-goldbright">→</span>
          </Link>
        </div>

        <Link
          href="/check"
          className="text-muted text-sm underline underline-offset-4 hover:text-goldbright"
        >
          Verify a ticket →
        </Link>
      </div>
    </main>
  );
}
