import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getOverviewAnalytics } from "@/lib/admin-analytics";

function parseDate(raw: string | null, fallbackEnd = false) {
  if (!raw) return undefined;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (fallbackEnd) parsed.setHours(23, 59, 59, 999);
  return parsed;
}

export async function GET(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const from = parseDate(searchParams.get("from"));
  const to = parseDate(searchParams.get("to"), true);
  const mode = searchParams.get("mode") ?? "ALL";

  const analytics = await getOverviewAnalytics({ from, to, mode });
  return NextResponse.json(analytics);
}
