"use client";

import { useRef, useState } from "react";
import { importTicketsCsv } from "@/app/(app)/events/actions";

export function CsvImport({ eventId }: { eventId: string }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result ?? "").trim());
      setFileName(file.name);
    };
    reader.readAsText(file);
  };

  return (
    <form action={importTicketsCsv} className="flex flex-col gap-3">
      <input type="hidden" name="eventId" value={eventId} />
      <label className="field">
        Bulk import — one guest per line: <code>name, phone, email, tier</code>{" "}
        (tier optional)
      </label>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          className="btn btn-outline text-sm"
          onClick={() => fileRef.current?.click()}
        >
          📄 Choose CSV file
        </button>
        {fileName && (
          <span className="text-muted text-xs">
            Loaded: {fileName} — review below, then import.
          </span>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) readFile(f);
            e.target.value = "";
          }}
        />
      </div>

      <textarea
        name="csv"
        rows={6}
        className="input font-mono text-sm"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          "…or paste guests here:\nEdward Kenway, 555-0101, edward@jackdaw.sea, VIP\nAdéwalé, 555-0102"
        }
      />
      <div className="flex items-center gap-3">
        <select name="tier" className="input w-auto">
          <option value="NORMAL">Default: Recruit</option>
          <option value="VIP">Default: Brotherhood</option>
        </select>
        <button className="btn btn-gold" disabled={!text.trim()}>
          Import
        </button>
      </div>
    </form>
  );
}
