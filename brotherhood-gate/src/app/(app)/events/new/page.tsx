"use client";

import { useActionState } from "react";
import { createEvent } from "../actions";

export default function NewEventPage() {
  const [state, action, pending] = useActionState(createEvent, null);

  return (
    <div className="max-w-lg mx-auto flex flex-col gap-5">
      <h1 className="text-2xl text-goldbright">Chart a New Course</h1>
      <form action={action} className="panel p-5 flex flex-col gap-4">
        <div>
          <label className="field" htmlFor="name">Event name</label>
          <input id="name" name="name" className="input" placeholder="Havana Night" required />
        </div>
        <div>
          <label className="field" htmlFor="venue">Venue</label>
          <input id="venue" name="venue" className="input" placeholder="The Jackdaw" required />
        </div>
        <div>
          <label className="field" htmlFor="startsAt">Date &amp; time</label>
          <input id="startsAt" name="startsAt" type="datetime-local" className="input" required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field" htmlFor="capacityNormal">Recruit capacity</label>
            <input id="capacityNormal" name="capacityNormal" type="number" min="0" className="input" placeholder="400" />
          </div>
          <div>
            <label className="field" htmlFor="capacityVip">Brotherhood (VIP) capacity</label>
            <input id="capacityVip" name="capacityVip" type="number" min="0" className="input" placeholder="50" />
          </div>
        </div>
        {state?.error && (
          <p className="text-bloodbright text-sm">{state.error}</p>
        )}
        <button className="btn btn-gold w-full" disabled={pending}>
          {pending ? "Creating…" : "Create Event"}
        </button>
      </form>
    </div>
  );
}
