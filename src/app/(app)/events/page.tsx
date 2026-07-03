import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function EventsPage() {
  const user = (await getSession())!;
  const events = await db.event.findMany({
    orderBy: { startsAt: "desc" },
    include: { _count: { select: { tickets: true } } },
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl text-goldbright">Missions</h1>
        {user.role === "ADMIN" && (
          <Link href="/events/new" className="btn btn-gold">
            + New Event
          </Link>
        )}
      </div>
      <div className="panel divide-y divide-line">
        {events.length === 0 && (
          <p className="p-5 text-muted">No events yet. Chart your first course.</p>
        )}
        {events.map((e) => (
          <Link
            key={e.id}
            href={`/events/${e.id}`}
            className="flex items-center justify-between gap-3 p-4 hover:bg-panel2 transition-colors"
          >
            <div className="min-w-0">
              <p className="font-semibold truncate">{e.name}</p>
              <p className="text-muted text-xs">
                {e.venue} ·{" "}
                {new Date(e.startsAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}{" "}
                · {e._count.tickets} tickets
              </p>
            </div>
            <span
              className={`badge shrink-0 ${
                e.status === "OPEN"
                  ? "badge-green"
                  : e.status === "CLOSED"
                  ? "badge-red"
                  : "badge-muted"
              }`}
            >
              {e.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
