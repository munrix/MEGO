import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { addBlacklistEntry, removeBlacklistEntry } from "./actions";

export const dynamic = "force-dynamic";

export default async function BlacklistPage() {
  const user = (await getSession())!;
  if (user.role !== "ADMIN") redirect("/dashboard");

  const [entries, events] = await Promise.all([
    db.blacklistEntry.findMany({ orderBy: { createdAt: "desc" } }),
    db.event.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: { startsAt: "desc" },
    }),
  ]);

  const eventName = (id: string | null) =>
    id ? events.find((e) => e.id === id)?.name ?? "unknown event" : null;

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl text-bloodbright">The Templar List</h1>
        <p className="text-muted text-sm">
          Names here are denied at every gate. Their live tickets are revoked the
          moment they&apos;re added.
        </p>
      </div>

      <form action={addBlacklistEntry} className="panel p-4 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field">Name (must match ticket holder)</label>
            <input name="name" className="input" required placeholder="Laureano Torres" />
          </div>
          <div>
            <label className="field">Phone (optional)</label>
            <input name="phone" className="input" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field">Reason (shown to gate staff)</label>
            <input name="reason" className="input" placeholder="Caused trouble at Havana Night" />
          </div>
          <div>
            <label className="field">Scope</label>
            <select name="eventId" className="input">
              <option value="">All events (global)</option>
              {events.map((e) => (
                <option key={e.id} value={e.id}>
                  Only: {e.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-danger self-start">☠ Add to Templar List</button>
      </form>

      <div className="panel divide-y divide-line">
        {entries.length === 0 && (
          <p className="p-4 text-muted text-sm">The list is empty. Peace, for now.</p>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{entry.name}</p>
              <p className="text-muted text-xs">
                {entry.reason || "No reason recorded"}
                {entry.phone && ` · ${entry.phone}`}
                {" · "}
                {eventName(entry.eventId) ?? "global"}
              </p>
            </div>
            <form action={removeBlacklistEntry.bind(null, entry.id)}>
              <button className="btn btn-outline text-xs px-3 py-1.5 shrink-0">
                Pardon
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
