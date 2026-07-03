import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generateTickets, updateEventStatus } from "../actions";
import { TicketRow } from "@/components/TicketRow";
import { CsvImport } from "@/components/CsvImport";

export const dynamic = "force-dynamic";

export default async function EventDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { id } = await params;
  const { q = "", filter = "all" } = await searchParams;
  const user = (await getSession())!;
  const isAdmin = user.role === "ADMIN";

  const event = await db.event.findUnique({ where: { id } });
  if (!event) notFound();

  const where: Record<string, unknown> = { eventId: id };
  if (q) where.OR = [
    { holderName: { contains: q } },
    { shortCode: { contains: q.toUpperCase() } },
  ];
  if (filter === "in") where.status = "CHECKED_IN";
  if (filter === "out") where.status = "VALID";
  if (filter === "vip") where.tier = "VIP";
  if (filter === "revoked") where.status = { in: ["REVOKED", "VOID"] };

  const [tickets, total, checkedIn, vipIn, vipTotal, staff] = await Promise.all([
    db.ticket.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 300,
    }),
    db.ticket.count({ where: { eventId: id } }),
    db.ticket.count({ where: { eventId: id, status: "CHECKED_IN" } }),
    db.ticket.count({ where: { eventId: id, tier: "VIP", status: "CHECKED_IN" } }),
    db.ticket.count({ where: { eventId: id, tier: "VIP", status: { in: ["VALID", "CHECKED_IN"] } } }),
    db.user.findMany({ select: { id: true, name: true } }),
  ]);
  const staffName = new Map(staff.map((s) => [s.id, s.name]));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-goldbright">{event.name}</h1>
          <p className="text-muted text-sm">
            {event.venue} ·{" "}
            {new Date(event.startsAt).toLocaleString(undefined, {
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <span className={`badge ${event.status === "OPEN" ? "badge-green" : "badge-red"}`}>
            {event.status}
          </span>
          {isAdmin && event.status === "OPEN" && (
            <form action={updateEventStatus.bind(null, id, "CLOSED")}>
              <button className="btn btn-danger text-xs px-3 py-1.5">Close Gates</button>
            </form>
          )}
          {isAdmin && event.status === "CLOSED" && (
            <form action={updateEventStatus.bind(null, id, "OPEN")}>
              <button className="btn btn-green text-xs px-3 py-1.5">Reopen</button>
            </form>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="panel p-3.5 text-center">
          <p className="stat-value text-3xl font-bold text-goldbright">{checkedIn}</p>
          <p className="text-muted text-xs uppercase tracking-widest mt-1">Inside</p>
        </div>
        <div className="panel p-3.5 text-center">
          <p className="stat-value text-3xl font-bold">{total}</p>
          <p className="text-muted text-xs uppercase tracking-widest mt-1">Tickets</p>
        </div>
        <div className="panel p-3.5 text-center">
          <p className="stat-value text-3xl font-bold text-goldbright">{vipIn}<span className="text-muted text-base">/{vipTotal}</span></p>
          <p className="text-muted text-xs uppercase tracking-widest mt-1">VIP in</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href={`/scan?event=${id}`} className="btn btn-gold">
          ◈ Scan Gate
        </Link>
        {isAdmin && (
          <>
            <a href={`/api/events/${id}/tickets.pdf`} className="btn btn-outline">
              ⬇ PDF Sheets
            </a>
            <a href={`/api/events/${id}/tickets.zip`} className="btn btn-outline">
              ⬇ PNG ZIP
            </a>
            <a href={`/api/events/${id}/export.csv`} className="btn btn-outline">
              ⬇ CSV
            </a>
          </>
        )}
      </div>

      {isAdmin && (
        <details className="panel">
          <summary className="p-4 cursor-pointer select-none font-semibold text-goldbright">
            ⚒ Forge Tickets
          </summary>
          <div className="p-4 pt-0 flex flex-col gap-6">
            <form action={generateTickets} className="flex flex-col gap-3">
              <input type="hidden" name="eventId" value={id} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="field">Tier</label>
                  <select name="tier" className="input">
                    <option value="NORMAL">Recruit (Normal)</option>
                    <option value="VIP">Brotherhood (VIP)</option>
                  </select>
                </div>
                <div>
                  <label className="field">Count</label>
                  <input name="count" type="number" min="1" max="1000" defaultValue="1" className="input" />
                </div>
              </div>
              <p className="text-muted text-xs">Holder details (only applied when count = 1):</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input name="holderName" placeholder="Name" className="input" />
                <input name="holderPhone" placeholder="Phone" className="input" />
                <input name="holderEmail" placeholder="Email" className="input" />
              </div>
              <button className="btn btn-gold self-start">Generate</button>
            </form>

            <div className="border-t border-line pt-4">
              <CsvImport eventId={id} />
            </div>
          </div>
        </details>
      )}

      {/* Attendee list */}
      <section className="flex flex-col gap-3">
        <form className="flex gap-2" action={`/events/${id}`} method="GET">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or code…"
            className="input"
          />
          <button className="btn btn-outline shrink-0">Search</button>
        </form>
        <div className="flex gap-1.5 flex-wrap text-sm">
          {[
            ["all", "All"],
            ["out", "Not arrived"],
            ["in", "Inside"],
            ["vip", "VIP"],
            ["revoked", "Revoked"],
          ].map(([key, label]) => (
            <Link
              key={key}
              href={`/events/${id}?filter=${key}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`badge ${filter === key ? "badge-vip" : "badge-muted"}`}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="panel divide-y divide-line">
          {tickets.length === 0 && (
            <p className="p-4 text-muted text-sm">No tickets match.</p>
          )}
          {tickets.map((t) => (
            <TicketRow
              key={t.id}
              ticket={{
                id: t.id,
                shortCode: t.shortCode,
                tier: t.tier,
                status: t.status,
                holderName: t.holderName,
                checkedInAt: t.checkedInAt?.toISOString() ?? null,
                checkedInByName: t.checkedInBy
                  ? staffName.get(t.checkedInBy) ?? null
                  : null,
              }}
              isAdmin={isAdmin}
            />
          ))}
        </div>
        {tickets.length === 300 && (
          <p className="text-muted text-xs">Showing first 300 — refine your search.</p>
        )}
      </section>
    </div>
  );
}
