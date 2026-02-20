import { NextResponse } from "next/server";
import { getSessionId } from "@/lib/session";

export async function GET() {
  const sessionId = await getSessionId();
  return NextResponse.json({ sessionId });
}
