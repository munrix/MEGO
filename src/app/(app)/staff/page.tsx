import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { StaffForm, StaffRowActions } from "./ui";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = (await getSession())!;
  if (user.role !== "ADMIN") redirect("/dashboard");

  const staff = await db.user.findMany({ orderBy: { createdAt: "asc" } });

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl text-goldbright">The Crew</h1>
          <p className="text-muted text-sm">
            Mentors run everything; Assassins can scan and check people in.
          </p>
        </div>
        <Link href="/audit" className="btn btn-outline text-xs shrink-0">
          📜 Codex (audit log)
        </Link>
      </div>

      <StaffForm />

      <div className="panel divide-y divide-line">
        {staff.map((s) => (
          <div key={s.id} className="p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">
                {s.name}{" "}
                <span className="text-muted font-normal text-sm">@{s.username}</span>
              </p>
              <div className="flex gap-1.5 mt-1">
                <span className={`badge ${s.role === "ADMIN" ? "badge-vip" : "badge-muted"}`}>
                  {s.role === "ADMIN" ? "Mentor" : "Assassin"}
                </span>
                {!s.active && <span className="badge badge-red">Deactivated</span>}
              </div>
            </div>
            {s.id !== user.id && <StaffRowActions userId={s.id} active={s.active} />}
          </div>
        ))}
      </div>
    </div>
  );
}
