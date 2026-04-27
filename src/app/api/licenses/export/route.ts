import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { exportLicenseCsv } from "@/lib/licenseTransfer";

const dateStamp = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const csv = await exportLicenseCsv(prisma);
  const filename = `licenses-${dateStamp()}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
