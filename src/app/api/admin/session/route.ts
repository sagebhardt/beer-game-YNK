import { NextResponse } from "next/server";
import {
  clearAdminSession,
  isAdminSession,
  setAdminSession,
} from "@/lib/admin-auth";

export async function GET() {
  const authenticated = await isAdminSession();
  return NextResponse.json({ authenticated });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key } = body;

    if (!process.env.ADMIN_PANEL_KEY) {
      return NextResponse.json(
        { error: "ADMIN_PANEL_KEY no está configurado" },
        { status: 500 }
      );
    }

    if (typeof key !== "string" || key !== process.env.ADMIN_PANEL_KEY) {
      return NextResponse.json(
        { error: "Clave inválida" },
        { status: 401 }
      );
    }

    await setAdminSession();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Solicitud inválida" },
      { status: 400 }
    );
  }
}

export async function DELETE() {
  await clearAdminSession();
  return NextResponse.json({ success: true });
}
