import { db } from "@/lib/db";
import { Scanner } from "@/components/Scanner";

export const dynamic = "force-dynamic";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string }>;
}) {
  const { event: preselected } = await searchParams;
  const events = await db.event.findMany({
    where: { status: "OPEN" },
    orderBy: { startsAt: "asc" },
    select: { id: true, name: true, venue: true },
  });

  return <Scanner events={events} preselected={preselected} />;
}
