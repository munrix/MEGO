"use client";

import { useTransition } from "react";
import { deleteEvent } from "@/app/(app)/events/actions";

export function DeleteEventButton({ eventId }: { eventId: string }) {
  const [pending, start] = useTransition();

  const handleDelete = () => {
    if (
      window.confirm(
        "Are you sure you want to permanently delete this event? This will delete all tickets and scan logs for this event. This cannot be undone."
      )
    ) {
      start(async () => {
        await deleteEvent(eventId);
      });
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={pending}
      className="btn btn-danger text-xs px-3 py-1.5 bg-red-800 border-none font-semibold hover:bg-red-700 disabled:opacity-50"
    >
      {pending ? "Deleting..." : "🗑 Delete Event"}
    </button>
  );
}
