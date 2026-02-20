import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getAdminDashboardGames } from "@/lib/admin-monitor";

export async function GET(request: Request) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "ALL";
  const mode = searchParams.get("mode") ?? "ALL";
  const q = searchParams.get("q") ?? "";

  const games = await getAdminDashboardGames({ status, mode, q });
  return NextResponse.json({ games });
}
