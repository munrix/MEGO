# MEGO

Two Assassin's Creed: Black Flag themed event tools in one app — pick at `/`:

1. **Ticket Command** — QR ticket management for admins ("Mentors") and security
   staff ("Assassins") working the door.
2. **Treasure Hunt** — mall-wide scavenger hunt: open registration, personal
   randomized routes through 8 QR stations, live winner placement, redemption desk
   view, and a cinema big-screen display.

## Treasure Hunt quick reference

- Player app: `/hunt` (register, AR-primary RTL + EN toggle) → `/hunt/play`
- Station QR target: `/s/<slug>?t=<token>` — print posters from Hunt admin
- Staff: `/hunt/admin` (config, stations, clue editing, player search, KEY GIVEN,
  flags, CSV export) — Mentors see everything, Assassins see redemption tools
- Big screen: `/hunt/screen` (public, display-only, auto-refresh)
- Seed stations/config: `npx tsx prisma/seed-hunt.ts`
- Anti-cheat: HMAC-free but token-gated stations, server timestamps only,
  auto-flags (<10 min completion, cross-floor scans <45 s), atomic placement.

## Quick start

```bash
npm install
npx prisma migrate dev      # creates prisma/dev.db
npx tsx prisma/seed.ts      # seeds admin account
npm run dev
```

Default admin login: **mentor / mentor123** — change it from the Crew page
(or reset via seed) before going live.

## Environment (.env)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file path (`file:./dev.db`) |
| `SESSION_SECRET` | Signs login session cookies — set a long random value in production |
| `TICKET_SECRET` | Signs QR payloads (HMAC). **Changing it invalidates every issued ticket.** |

## Features

- **Events** — create, per-tier capacity, open/close gates, live check-in stats
- **Tickets** — single / bulk / CSV-paste generation, Recruit (normal) & Brotherhood (VIP)
  tiers with distinct Black Flag designs, HMAC-signed QR + human short code (`BF-XXXXX`),
  download as PNG, PDF sheets, or ZIP
- **Scanner** — browser camera scanning, full-screen verdicts (valid / duplicate / revoked /
  TEMPLAR / forged), auto check-in mode, vibration feedback, manual code fallback
- **Templar list** — global or per-event blacklist; adding a name auto-revokes their tickets
- **Crew** — Mentor (admin) and Assassin (scan-only) accounts, deactivate/reset
- **Codex** — full audit log of every action
- **Public checker** — `/check` lets anyone verify a ticket (validity + tier only, rate-limited)
- **PWA** — add to home screen for an app-like fullscreen scanner

## Deployment notes

- **Camera scanning requires HTTPS** (any real domain/host does this; localhost also works).
- SQLite needs a persistent disk: Railway, Fly.io, Render, or any VPS work out of the box.
  For Vercel/serverless, swap the Prisma datasource to Turso or Postgres.
- Set fresh `SESSION_SECRET` / `TICKET_SECRET` values in production.
- Run `npx prisma migrate deploy && npx tsx prisma/seed.ts` once on the server.

## Phase 2 (planned)

Attendee-facing accounts: self-serve ticket wallet, email delivery, transfers.
The schema already carries holder name/phone/email on tickets so this bolts on cleanly.
