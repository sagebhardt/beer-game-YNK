import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import { finalizeGameByCode } from "@/lib/admin-actions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { code } = await params;
  const game = await finalizeGameByCode(code, "ADMIN_TERMINATED");

  if (!game) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
