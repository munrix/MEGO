import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = (await getSession())!;

  const events = await db.event.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { startsAt: "asc" },
    include: {
      _count: { select: { tickets: true } },
    },
  });

  const stats = await Promise.all(
    events.map(async (e) => {
      const [checkedIn, vipTotal, vipIn] = await Promise.all([
        db.ticket.count({ where: { eventId: e.id, status: "CHECKED_IN" } }),
        db.ticket.count({ where: { eventId: e.id, tier: "VIP", status: { in: ["VALID", "CHECKED_IN"] } } }),
        db.ticket.count({ where: { eventId: e.id, tier: "VIP", status: "CHECKED_IN" } }),
      ]);
      return { event: e, checkedIn, vipTotal, vipIn };
    })
  );

  const recentScans = await db.scanLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      ticket: { select: { shortCode: true, holderName: true, tier: true } },
      user: { select: { name: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl text-goldbright">The Den</h1>
        <p className="text-muted text-sm">
          Welcome back, {user.name}. {events.length === 0 ? "No missions on the board." : "The board awaits."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {stats.map(({ event, checkedIn, vipTotal, vipIn }) => {
          const capacity = event.capacityNormal + event.capacityVip;
          const total = event._count.tickets;
          const pct = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
          return (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="panel p-4 hover:border-gold transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg leading-tight">{event.name}</h2>
                  <p className="text-muted text-xs mt-0.5">
                    {event.venue} ·{" "}
                    {new Date(event.startsAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <span className={`badge ${event.status === "OPEN" ? "badge-green" : "badge-red"}`}>
                  {event.status}
                </span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted">Checked in</span>
                  <span>
                    <strong className="text-goldbright">{checkedIn}</strong>
                    <span className="text-muted"> / {total} tickets</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-panel2 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: "linear-gradient(90deg, #a8862f, #e6c47c)",
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted mt-2">
                  <span>
                    VIP: <span className="text-goldbright">{vipIn}/{vipTotal}</span>
                  </span>
                  {capacity > 0 && <span>Capacity {capacity}</span>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {user.role === "ADMIN" && (
        <Link href="/events/new" className="btn btn-gold self-start">
          + New Event
        </Link>
      )}

      <section>
        <h2 className="text-base text-muted uppercase tracking-widest mb-3">
          Recent activity
        </h2>
        <div className="panel divide-y divide-line">
          {recentScans.length === 0 && (
            <p className="p-4 text-muted text-sm">No scans yet. The gates are quiet.</p>
          )}
          {recentScans.map((s) => (
            <div key={s.id} className="p-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <span className="font-medium">
                  {s.ticket.holderName || s.ticket.shortCode}
                </span>
                {s.ticket.tier === "VIP" && (
                  <span className="badge badge-vip ml-2">VIP</span>
                )}
                <p className="text-muted text-xs">
                  by {s.user?.name ?? "system"} ·{" "}
                  {new Date(s.createdAt).toLocaleTimeString()}
                </p>
              </div>
              <span
                className={`badge ${
                  s.result === "OK"
                    ? "badge-green"
                    : s.result === "DUPLICATE"
                    ? "badge-muted"
                    : "badge-red"
                }`}
              >
                {s.result}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
