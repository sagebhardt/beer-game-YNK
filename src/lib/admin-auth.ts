import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE_NAME = "beer-admin";
const ADMIN_TOKEN_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function getAdminKey() {
  return process.env.ADMIN_PANEL_KEY ?? "";
}

function sign(payload: string, key: string) {
  return createHmac("sha256", key).update(payload).digest("hex");
}

export function createAdminToken() {
  const key = getAdminKey();
  if (!key) {
    throw new Error("ADMIN_PANEL_KEY no configurado");
  }

  const payload = `${Date.now()}.${Math.random().toString(36).slice(2)}`;
  const signature = sign(payload, key);
  return `${payload}.${signature}`;
}

export function verifyAdminToken(token: string | null | undefined) {
  const key = getAdminKey();
  if (!key || !token) return false;

  const parts = token.split(".");
  if (parts.length < 3) return false;

  const signature = parts.pop();
  if (!signature) return false;

  const payload = parts.join(".");
  const expected = sign(payload, key);

  const signatureBuf = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (signatureBuf.length !== expectedBuf.length) return false;
  if (!timingSafeEqual(signatureBuf, expectedBuf)) return false;

  const issuedAtRaw = Number(parts[0]);
  if (!Number.isFinite(issuedAtRaw)) return false;

  return Date.now() - issuedAtRaw <= ADMIN_TOKEN_TTL_MS;
}

function parseCookieHeader(header: string | undefined) {
  if (!header) return null;

  const chunks = header.split(";");
  for (const chunk of chunks) {
    const [rawName, ...rest] = chunk.trim().split("=");
    if (rawName === ADMIN_COOKIE_NAME) {
      return decodeURIComponent(rest.join("="));
    }
  }

  return null;
}

export function isAdminFromCookieHeader(cookieHeader: string | undefined) {
  const token = parseCookieHeader(cookieHeader);
  return verifyAdminToken(token);
}

export async function isAdminSession() {
  const store = await cookies();
  const token = store.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminToken(token);
}

export async function setAdminSession() {
  const store = await cookies();
  const token = createAdminToken();
  store.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TOKEN_TTL_MS / 1000,
  });
}

export async function clearAdminSession() {
  const store = await cookies();
  store.delete(ADMIN_COOKIE_NAME);
}
