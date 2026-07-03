"use client";

import { useState, useTransition } from "react";
import {
  manualCheckIn,
  undoCheckIn,
  revokeTicket,
  restoreTicket,
  assignHolder,
} from "@/app/(app)/events/actions";

type Ticket = {
  id: string;
  shortCode: string;
  tier: string;
  status: string;
  holderName: string | null;
  checkedInAt: string | null;
  checkedInByName?: string | null;
};

export function TicketRow({ ticket, isAdmin }: { ticket: Ticket; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);

  const statusBadge =
    ticket.status === "CHECKED_IN"
      ? "badge-green"
      : ticket.status === "VALID"
      ? "badge-muted"
      : "badge-red";

  return (
    <div className="p-3 flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          {editing ? (
            <form
              action={(fd) => {
                start(async () => {
                  await assignHolder(fd);
                  setEditing(false);
                });
              }}
              className="flex gap-1.5"
            >
              <input type="hidden" name="ticketId" value={ticket.id} />
              <input
                name="holderName"
                defaultValue={ticket.holderName ?? ""}
                className="input py-1 text-sm"
                autoFocus
              />
              <button className="btn btn-gold text-xs px-2 py-1">Save</button>
            </form>
          ) : (
            <span className="font-medium truncate">
              {ticket.holderName || <span className="text-muted italic">unassigned</span>}
            </span>
          )}
          {ticket.tier === "VIP" && <span className="badge badge-vip">VIP</span>}
          <span className={`badge ${statusBadge}`}>{ticket.status.replace("_", " ")}</span>
        </div>
        <p className="text-muted text-xs font-mono mt-0.5">
          {ticket.shortCode}
          {ticket.checkedInAt &&
            ` · in at ${new Date(ticket.checkedInAt).toLocaleTimeString()}`}
          {ticket.checkedInByName && (
            <span className="text-goldbright"> by {ticket.checkedInByName}</span>
          )}
        </p>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {ticket.status === "VALID" && (
          <button
            disabled={pending}
            onClick={() => start(() => manualCheckIn(ticket.id))}
            className="btn btn-green text-xs px-2.5 py-1.5"
          >
            Check in
          </button>
        )}
        {ticket.status === "CHECKED_IN" && (
          <button
            disabled={pending}
            onClick={() => start(() => undoCheckIn(ticket.id))}
            className="btn btn-outline text-xs px-2.5 py-1.5"
          >
            Undo
          </button>
        )}
        {isAdmin && (
          <div className="relative">
            <MenuButton ticket={ticket} pending={pending} start={start} onEdit={() => setEditing(true)} />
          </div>
        )}
      </div>
    </div>
  );
}

function MenuButton({
  ticket,
  pending,
  start,
  onEdit,
}: {
  ticket: Ticket;
  pending: boolean;
  start: (fn: () => Promise<void>) => void;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn btn-outline text-xs px-2 py-1.5"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div
          className="absolute right-0 top-9 z-30 panel p-1 flex flex-col min-w-36 shadow-xl"
          onClick={() => setOpen(false)}
        >
          <a
            href={`/api/tickets/${ticket.id}/png`}
            className="px-3 py-2 text-sm hover:bg-panel2 rounded"
          >
            ⬇ Download PNG
          </a>
          <button
            onClick={onEdit}
            className="px-3 py-2 text-sm text-left hover:bg-panel2 rounded"
          >
            ✎ Edit name
          </button>
          {ticket.status !== "REVOKED" && ticket.status !== "CHECKED_IN" && (
            <button
              disabled={pending}
              onClick={() => start(() => revokeTicket(ticket.id))}
              className="px-3 py-2 text-sm text-left text-bloodbright hover:bg-panel2 rounded"
            >
              ✕ Revoke
            </button>
          )}
          {ticket.status === "REVOKED" && (
            <button
              disabled={pending}
              onClick={() => start(() => restoreTicket(ticket.id))}
              className="px-3 py-2 text-sm text-left text-creedbright hover:bg-panel2 rounded"
            >
              ↺ Restore
            </button>
          )}
        </div>
      )}
    </>
  );
}
