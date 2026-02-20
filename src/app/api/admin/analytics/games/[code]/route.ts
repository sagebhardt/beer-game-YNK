import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { getGameAnalyticsByCode } from "@/lib/admin-analytics";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { code } = await params;
  const analytics = await getGameAnalyticsByCode(code);

  if (!analytics) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  return NextResponse.json(analytics);
}
