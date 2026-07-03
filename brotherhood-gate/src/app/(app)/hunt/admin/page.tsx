import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getHuntConfig, huntPhase } from "@/lib/hunt";
import {
  updateHuntConfig,
  toggleStation,
  regenStationToken,
  updateClue,
  giveKey,
  clearFlag,
  disqualify,
  startHunt,
  stopHunt,
} from "./actions";

export const dynamic = "force-dynamic";

function dtLocal(d: Date): string {
  // datetime-local value in server-local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default async function HuntAdmin({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sel?: string }>;
}) {
  const { q = "", sel } = await searchParams;
  const user = (await getSession())!;
  const isAdmin = user.role === "ADMIN";

  const cfg = await getHuntConfig();
  const phase = huntPhase(cfg);

  const tenMinAgo = new Date(Date.now() - 10 * 60_000);
  const [registered, finished, keysGiven, flaggedCount, recentScanCount, stations, funnel] =
    await Promise.all([
      db.huntPlayer.count(),
      db.huntPlayer.count({ where: { completedAt: { not: null } } }),
      db.huntPlayer.count({ where: { keyGivenAt: { not: null } } }),
      db.huntPlayer.count({ where: { flagged: true } }),
      db.huntScan.count({ where: { scannedAt: { gte: tenMinAgo } } }),
      db.huntStation.findMany({
        orderBy: { sortKey: "asc" },
        include: { _count: { select: { scans: true } } },
      }),
      db.huntScan.groupBy({ by: ["playerId"], _count: true }),
    ]);

  // completion funnel 0..8
  const buckets = Array.from({ length: 9 }, () => 0);
  const scansPerPlayer = new Map(funnel.map((f) => [f.playerId, f._count]));
  buckets[0] = registered - funnel.length;
  for (const [, count] of scansPerPlayer) buckets[Math.min(count, 8)]++;

  const players = await db.huntPlayer.findMany({
    where: q ? { fullName: { contains: q, mode: "insensitive" } } : {},
    orderBy: [{ completedAt: "asc" }, { registeredAt: "desc" }],
    take: 50,
    include: { _count: { select: { scans: true } } },
  });

  const selected = sel
    ? await db.huntPlayer.findUnique({
        where: { id: sel },
        include: {
          scans: {
            orderBy: { scannedAt: "asc" },
            include: { station: { select: { nameEn: true, floor: true } } },
          },
        },
      })
    : null;

  const staffNames = new Map(
    (await db.user.findMany({ select: { id: true, name: true } })).map((s) => [s.id, s.name])
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl text-goldbright">Treasure Hunt Command</h1>
          <p className="text-muted text-sm">
            Phase:{" "}
            <span className={`badge ${phase === "open" ? "badge-green" : phase === "closed" ? "badge-red" : "badge-vip"}`}>
              {phase.replace("_", " ").toUpperCase()}
            </span>
            {cfg.killSwitch && <span className="badge badge-red ml-2">KILL SWITCH ON</span>}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {isAdmin && (
            <>
              {phase === "open" ? (
                <form action={stopHunt}>
                  <button className="btn btn-danger text-xs font-bold px-3 py-1.5 rounded">
                    🛑 Stop Hunt
                  </button>
                </form>
              ) : (
                <form action={startHunt}>
                  <button className="btn btn-green text-xs font-bold px-3 py-1.5 rounded">
                    ▶ Start Hunt
                  </button>
                </form>
              )}
            </>
          )}
          <Link href="/hunt/screen" className="btn btn-outline text-xs" target="_blank">
            📺 Big screen
          </Link>
          <a href="/api/hunt/admin/export.csv" className="btn btn-outline text-xs">
            ⬇ CSV
          </a>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          [registered, "Hunters"],
          [finished, "Finished"],
          [`${keysGiven}/${cfg.maxWinners}`, "Keys given"],
          [recentScanCount, "Scans /10min"],
          [flaggedCount, "Flagged"],
        ].map(([v, label]) => (
          <div key={String(label)} className="panel p-3.5 text-center">
            <p className="stat-value text-2xl font-bold text-goldbright">{v}</p>
            <p className="text-muted text-xs uppercase tracking-widest mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* completion funnel */}
      <div className="panel p-4">
        <h2 className="text-sm text-muted uppercase tracking-widest mb-3">
          Completion funnel (marks found)
        </h2>
        <div className="flex items-end gap-1.5 h-24">
          {buckets.map((count, i) => {
            const max = Math.max(...buckets, 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-goldbright">{count || ""}</span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-[#a8862f] to-[#e6c47c]"
                  style={{ height: `${Math.max((count / max) * 100, 2)}%` }}
                />
                <span className="text-[0.6rem] text-muted">{i}</span>
              </div>
            );
          })}
        </div>
      </div>

      {isAdmin && (
        <details className="panel">
          <summary className="p-4 cursor-pointer select-none font-semibold text-goldbright">
            ⚙ Hunt configuration
          </summary>
          <form action={updateHuntConfig} className="p-4 pt-0 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="field">Registration opens</label>
                <input name="registrationAt" type="datetime-local" className="input" defaultValue={dtLocal(cfg.registrationAt)} />
              </div>
              <div>
                <label className="field">Scans open</label>
                <input name="opensAt" type="datetime-local" className="input" defaultValue={dtLocal(cfg.opensAt)} />
              </div>
              <div>
                <label className="field">Scans close</label>
                <input name="closesAt" type="datetime-local" className="input" defaultValue={dtLocal(cfg.closesAt)} />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="field">Game keys (N)</label>
                <input name="maxWinners" type="number" min="1" className="input" defaultValue={cfg.maxWinners} />
              </div>
              <div>
                <label className="field">Required marks</label>
                <input name="requiredCount" type="number" min="1" max="8" className="input" defaultValue={cfg.requiredCount} />
              </div>
              <label className="flex items-center gap-2 text-sm py-2">
                <input type="checkbox" name="lenientMode" defaultChecked={cfg.lenientMode} className="w-4 h-4 accent-[#c9a35c]" />
                Lenient mode
              </label>
              <label className="flex items-center gap-2 text-sm py-2 text-bloodbright">
                <input type="checkbox" name="killSwitch" defaultChecked={cfg.killSwitch} className="w-4 h-4 accent-[#a3162a]" />
                Kill switch
              </label>
            </div>
            <button className="btn btn-gold self-start">Save config</button>
          </form>
        </details>
      )}

      {isAdmin && (
        <details className="panel">
          <summary className="p-4 cursor-pointer select-none font-semibold text-goldbright">
            📍 Stations ({stations.filter((s) => s.active).length}/{stations.length} active)
          </summary>
          <div className="p-4 pt-0 flex flex-col divide-y divide-line">
            {stations.map((s) => (
              <div key={s.id} className="py-3 flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="font-semibold">{s.nameEn}</span>{" "}
                    <span className="text-muted">{s.nameAr}</span>
                    <span className="badge badge-muted ml-2">{s.floor}</span>
                    {!s.active && <span className="badge badge-red ml-1">DISABLED</span>}
                    <p className="text-muted text-xs font-mono mt-0.5">
                      /s/{s.slug}?t={s.token} · {s._count.scans} scans
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <a href={`/api/hunt/admin/poster/${s.id}`} className="btn btn-outline text-xs px-2.5 py-1.5">
                      ⬇ Poster
                    </a>
                    <form action={regenStationToken.bind(null, s.id)}>
                      <button className="btn btn-outline text-xs px-2.5 py-1.5">↻ New token</button>
                    </form>
                    <form action={toggleStation.bind(null, s.id)}>
                      <button className={`btn text-xs px-2.5 py-1.5 ${s.active ? "btn-danger" : "btn-green"}`}>
                        {s.active ? "Disable" : "Enable"}
                      </button>
                    </form>
                  </div>
                </div>
                <details>
                  <summary className="text-xs text-muted cursor-pointer">Edit clue</summary>
                  <form action={updateClue} className="flex flex-col gap-2 mt-2">
                    <input type="hidden" name="stationId" value={s.id} />
                    <textarea name="clueEn" rows={2} className="input text-sm" defaultValue={s.clueEn} />
                    <textarea name="clueAr" rows={2} className="input text-sm" dir="rtl" defaultValue={s.clueAr} />
                    <button className="btn btn-gold text-xs self-start px-3 py-1.5">Save clue</button>
                  </form>
                </details>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* player search + redemption */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg text-goldbright">Hunters &amp; Redemption</h2>
        <form className="flex gap-2" action="/hunt/admin" method="GET">
          <input name="q" defaultValue={q} placeholder="Search player name…" className="input" />
          <button className="btn btn-outline shrink-0">Search</button>
        </form>

        {selected && (
          <div className="panel p-4 border-gold flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="text-lg font-semibold">{selected.fullName}</p>
                <p className="text-muted text-xs">
                  {selected.phone && `${selected.phone} · `}
                  registered {selected.registeredAt.toLocaleTimeString()}
                  {selected.completedAt &&
                    ` · finished #${selected.placement} at ${selected.completedAt.toLocaleTimeString()}`}
                </p>
                {selected.flagged && (
                  <p className="badge badge-red mt-1">⚑ {selected.flagReason}</p>
                )}
                {selected.keyGivenAt && (
                  <p className="badge badge-green mt-1">
                    🗝 KEY GIVEN {selected.keyGivenAt.toLocaleTimeString()} by{" "}
                    {staffNames.get(selected.keyGivenBy ?? "") ?? "?"}
                  </p>
                )}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {selected.completedAt && !selected.keyGivenAt && !selected.flagged && (
                  <form action={giveKey.bind(null, selected.id)}>
                    <button className="btn btn-green">🗝 KEY GIVEN</button>
                  </form>
                )}
                {isAdmin && selected.flagged && selected.flagReason !== "DISQUALIFIED" && (
                  <form action={clearFlag.bind(null, selected.id)}>
                    <button className="btn btn-outline text-xs">Clear flag</button>
                  </form>
                )}
                {isAdmin && selected.flagReason !== "DISQUALIFIED" && (
                  <form action={disqualify.bind(null, selected.id)}>
                    <button className="btn btn-danger text-xs">Disqualify</button>
                  </form>
                )}
                <Link href={`/hunt/admin${q ? `?q=${encodeURIComponent(q)}` : ""}`} className="btn btn-outline text-xs">
                  ✕
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
              {selected.scans.map((s, i) => (
                <div key={s.id} className="flex justify-between bg-panel2 rounded px-3 py-1.5">
                  <span>
                    {i + 1}. {s.station.nameEn}{" "}
                    <span className="text-muted text-xs">({s.station.floor})</span>
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {s.scannedAt.toLocaleTimeString()}
                  </span>
                </div>
              ))}
              {selected.scans.length === 0 && (
                <p className="text-muted text-sm">No scans yet.</p>
              )}
            </div>
          </div>
        )}

        <div className="panel divide-y divide-line">
          {players.length === 0 && <p className="p-4 text-muted text-sm">No hunters found.</p>}
          {players.map((p) => (
            <Link
              key={p.id}
              href={`/hunt/admin?sel=${p.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className="p-3 flex items-center justify-between gap-3 hover:bg-panel2 transition-colors"
            >
              <div className="min-w-0">
                <span className="font-medium">{p.fullName}</span>
                {p.flagged && <span className="badge badge-red ml-2">⚑</span>}
                {p.keyGivenAt && <span className="badge badge-green ml-2">🗝</span>}
                <p className="text-muted text-xs">
                  {p._count.scans}/8
                  {p.placement && ` · finished #${p.placement}`}
                  {` · ${p.registeredAt.toLocaleTimeString()}`}
                </p>
              </div>
              <span className="stat-value text-goldbright font-bold shrink-0">
                {p.placement ? `#${p.placement}` : `${p._count.scans}/8`}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
