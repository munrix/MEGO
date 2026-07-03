import { redirect } from "next/navigation";
import Image from "next/image";
import { getSession } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { logout } from "@/app/login/actions";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect("/login");

  return (
    <div className="min-h-dvh flex flex-col">
      <header className="sticky top-0 z-40 bg-bg/85 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/theme/mego-wordmark.png"
              alt="MEGO"
              width={86}
              height={22}
              className="rounded-[4px]"
            />
            <span className="display text-xs tracking-widest text-muted uppercase hidden sm:inline">
              Ticket Command
            </span>
          </div>
          <form action={logout}>
            <button className="text-xs text-muted hover:text-bloodbright uppercase tracking-wider">
              {user.name} · Leave
            </button>
          </form>
        </div>
        <div className="hairline-gold" />
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-5 pb-28">
        {children}
      </main>
      <BottomNav role={user.role} />
    </div>
  );
}
