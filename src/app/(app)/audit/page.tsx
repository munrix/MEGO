import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = (await getSession())!;
  if (user.role !== "ADMIN") redirect("/dashboard");

  const logs = await db.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true } } },
  });

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl text-goldbright">The Codex</h1>
        <p className="text-muted text-sm">Every action, recorded. Last 200 entries.</p>
      </div>
      <div className="panel divide-y divide-line">
        {logs.map((log) => (
          <div key={log.id} className="p-3 text-sm flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="font-mono text-goldbright text-xs">{log.action}</span>
              {log.detail && <p className="text-ink truncate">{log.detail}</p>}
            </div>
            <div className="text-right shrink-0 text-muted text-xs">
              <p>{log.user?.name ?? "system"}</p>
              <p>{new Date(log.createdAt).toLocaleString()}</p>
            </div>
          </div>
        ))}
        {logs.length === 0 && <p className="p-4 text-muted text-sm">Nothing recorded yet.</p>}
      </div>
    </div>
  );
}
