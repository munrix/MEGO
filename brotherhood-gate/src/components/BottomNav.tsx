"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/dashboard", label: "Den", icon: "🏴", roles: ["ADMIN", "STAFF"] },
  { href: "/events", label: "Events", icon: "🗺️", roles: ["ADMIN", "STAFF"] },
  { href: "/scan", label: "Scan", icon: "◈", roles: ["ADMIN", "STAFF"], big: true },
  { href: "/hunt/admin", label: "Hunt", icon: "🧭", roles: ["ADMIN", "STAFF"] },
  { href: "/blacklist", label: "Templars", icon: "☠️", roles: ["ADMIN"] },
  { href: "/staff", label: "Crew", icon: "⚔️", roles: ["ADMIN"] },
];

export function BottomNav({ role }: { role: "ADMIN" | "STAFF" }) {
  const pathname = usePathname();
  const visible = items.filter((i) => i.roles.includes(role));

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-panel/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="hairline-gold" />
      <div className="max-w-5xl mx-auto flex items-stretch justify-around">
        {visible.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          if (item.big) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative -top-4 flex flex-col items-center"
              >
                <span
                  className={`flex items-center justify-center w-14 h-14 rounded-full text-2xl border-2 shadow-lg transition-colors ${
                    active
                      ? "bg-gold text-black border-goldbright"
                      : "bg-panel2 text-goldbright border-gold"
                  }`}
                >
                  {item.icon}
                </span>
                <span className={`text-[0.65rem] mt-0.5 uppercase tracking-wider ${active ? "text-goldbright" : "text-muted"}`}>
                  {item.label}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 px-3 min-w-16 ${
                active ? "text-goldbright" : "text-muted"
              }`}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[0.65rem] uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
