import { prisma } from "@/lib/db";
import { getIO } from "@/lib/socket-server";
import { S2C } from "@/lib/socket-events";
import { emitAdminGameRemoved, emitAdminGameUpsert } from "@/lib/admin-monitor";
import { maybeUpdateBenchmark } from "@/lib/benchmark";

export async function finalizeGameByCode(
  code: string,
  endedReason: "ADMIN_TERMINATED" | "ADMIN_CLOSED"
) {
  const game = await prisma.game.findUnique({
    where: { accessCode: code },
  });

  if (!game) return null;

  const now = new Date();

  const updated = await prisma.game.update({
    where: { id: game.id },
    data: {
      status: "COMPLETED",
      endedAt: game.endedAt ?? now,
      endedReason,
    },
  });

  const io = getIO();
  if (io) {
    io.to(code).emit(S2C.GAME_ENDED, {});
    await emitAdminGameUpsert(io, code);
  }

  // Try to save as benchmark (extends short games to totalRounds)
  maybeUpdateBenchmark(updated.id).catch((err) =>
    console.error("Error updating benchmark on finalize:", err)
  );

  return updated;
}

export async function deleteGameByCode(code: string) {
  const game = await prisma.game.findUnique({
    where: { accessCode: code },
    select: { id: true, accessCode: true },
  });

  if (!game) return false;

  await prisma.game.delete({ where: { id: game.id } });

  const io = getIO();
  if (io) {
    emitAdminGameRemoved(io, code);
  }

  return true;
}
