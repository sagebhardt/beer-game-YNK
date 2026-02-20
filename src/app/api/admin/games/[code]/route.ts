import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-guard";
import {
  getAdminGameDetailByCode,
  getAdminGameSummaryByCode,
} from "@/lib/admin-monitor";
import { deleteGameByCode } from "@/lib/admin-actions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { code } = await params;
  const detail = await getAdminGameDetailByCode(code);

  if (!detail) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { code } = await params;
  const deleted = await deleteGameByCode(code);

  if (!deleted) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { code } = await params;
  const body = await request.json();

  if (body?.action === "summary") {
    const summary = await getAdminGameSummaryByCode(code);
    if (!summary) {
      return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ summary });
  }

  return NextResponse.json({ error: "Acción no soportada" }, { status: 400 });
}
