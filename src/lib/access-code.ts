import { prisma } from "@/lib/db";

export async function generateAccessCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const num = Math.floor(Math.random() * 900) + 100; // 100-999
    const code = `BEER-${num}`;
    const existing = await prisma.game.findFirst({
      where: { accessCode: code },
    });
    if (!existing) return code;
  }
  // Fallback: use timestamp-based code
  const ts = Date.now().toString(36).toUpperCase().slice(-4);
  return `BEER-${ts}`;
}
