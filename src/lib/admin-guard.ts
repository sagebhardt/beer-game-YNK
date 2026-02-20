import { NextResponse } from "next/server";
import { isAdminSession } from "@/lib/admin-auth";

export async function requireAdmin() {
  const allowed = await isAdminSession();
  if (!allowed) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return null;
}
