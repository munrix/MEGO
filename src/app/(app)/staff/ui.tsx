"use client";

import { useActionState, useState, useTransition } from "react";
import { createStaff, toggleStaffActive, resetStaffPassword } from "./actions";

export function StaffForm() {
  const [state, action, pending] = useActionState(createStaff, null);

  return (
    <details className="panel">
      <summary className="p-4 cursor-pointer select-none font-semibold text-goldbright">
        + Recruit a crew member
      </summary>
      <form action={action} className="p-4 pt-0 flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field">Display name</label>
            <input name="name" className="input" required placeholder="Adéwalé" />
          </div>
          <div>
            <label className="field">Codename (login)</label>
            <input name="username" className="input" required autoCapitalize="none" placeholder="ade" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="field">Passphrase (6+ chars)</label>
            <input name="password" type="text" className="input" required minLength={6} />
          </div>
          <div>
            <label className="field">Rank</label>
            <select name="role" className="input">
              <option value="STAFF">Assassin (scan &amp; check-in)</option>
              <option value="ADMIN">Mentor (full control)</option>
            </select>
          </div>
        </div>
        {state?.error && <p className="text-bloodbright text-sm">{state.error}</p>}
        <button className="btn btn-gold self-start" disabled={pending}>
          {pending ? "Recruiting…" : "Recruit"}
        </button>
      </form>
    </details>
  );
}

export function StaffRowActions({ userId, active }: { userId: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [resetting, setResetting] = useState(false);

  return (
    <div className="flex gap-1.5 shrink-0 items-center">
      {resetting ? (
        <form
          action={(fd) => {
            start(async () => {
              await resetStaffPassword(fd);
              setResetting(false);
            });
          }}
          className="flex gap-1.5"
        >
          <input type="hidden" name="userId" value={userId} />
          <input
            name="password"
            placeholder="New passphrase"
            className="input py-1 text-sm w-36"
            minLength={6}
            autoFocus
          />
          <button className="btn btn-gold text-xs px-2 py-1" disabled={pending}>
            Set
          </button>
        </form>
      ) : (
        <>
          <button
            onClick={() => setResetting(true)}
            className="btn btn-outline text-xs px-2.5 py-1.5"
          >
            Reset pass
          </button>
          <button
            disabled={pending}
            onClick={() => start(() => toggleStaffActive(userId))}
            className={`btn text-xs px-2.5 py-1.5 ${active ? "btn-danger" : "btn-green"}`}
          >
            {active ? "Deactivate" : "Reactivate"}
          </button>
        </>
      )}
    </div>
  );
}
