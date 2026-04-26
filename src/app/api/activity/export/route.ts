import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";
import { getAuditFeedItems } from "@/lib/auditFeed";

const stripActorSuffix = (details: string | undefined, actor: string | undefined) => {
  if (!details || !actor) return details ?? "";
  const suffix = ` · by ${actor}`;
  return details.endsWith(suffix) ? details.slice(0, -suffix.length) : details;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const items = await getAuditFeedItems(prisma, 500);
  const rows = [
    ["timestamp", "scope", "action", "title", "actor", "details"],
    ...items.map((item) => [
      item.createdAt.toISOString(),
      item.scope,
      item.action,
      item.title,
      item.actor ?? "",
      stripActorSuffix(item.details, item.actor),
    ]),
  ];

  const filename = `audit-feed-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;

  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
