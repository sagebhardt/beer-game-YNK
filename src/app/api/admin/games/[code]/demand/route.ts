import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { DEMAND_PRESETS } from "@/lib/types";
import { getIO } from "@/lib/socket-server";
import { emitAdminGameUpsert } from "@/lib/admin-monitor";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const blocked = await requireAdmin();
  if (blocked) return blocked;

  const { code } = await params;
  const body = await request.json();
  const presetKey = String(body?.presetKey ?? "");

  const preset = DEMAND_PRESETS[presetKey];
  if (!preset) {
    return NextResponse.json({ error: "Preset inválido" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({
    where: { accessCode: code },
    select: { id: true, status: true, totalRounds: true },
  });

  if (!game) {
    return NextResponse.json({ error: "Juego no encontrado" }, { status: 404 });
  }

  if (game.status !== "LOBBY") {
    return NextResponse.json(
      { error: "Solo se puede editar demanda en LOBBY" },
      { status: 400 }
    );
  }

  const pattern = [...preset.pattern];
  while (pattern.length < game.totalRounds) {
    pattern.push(pattern[pattern.length - 1]);
  }

  await prisma.game.update({
    where: { id: game.id },
    data: {
      demandPresetKey: presetKey,
      demandPattern: JSON.stringify(pattern),
    },
  });

  const io = getIO();
  if (io) {
    await emitAdminGameUpsert(io, code);
  }

  return NextResponse.json({ success: true });
}
