import { cookies } from "next/headers";
import { COOKIE_NAME, SESSION_DAYS, authSecret, signSession, verifySession } from "./auth";
import { getDb } from "./db";
import type { Provider } from "./providers";

export type User = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  provider: Provider;
  model: string;
  tokenVersion: number;
};

export async function currentUser(): Promise<User | null> {
  const secret = authSecret();
  if (!secret) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const p = await verifySession(token, secret);
  if (!p) return null;
  const rows = await (await getDb()).query(
    "select id, username, display_name, role, active, token_version, ai_provider, ai_model from users where id = $1",
    [p.uid],
  );
  const u = rows[0];
  if (!u || !u.active || u.token_version !== p.tv) return null;
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    role: u.role === "admin" ? "admin" : "user",
    provider: (u.ai_provider as Provider) || "gemini",
    model: u.ai_model || "",
    tokenVersion: u.token_version,
  };
}

export async function makeSessionCookie(userId: string, tokenVersion: number) {
  const secret = authSecret();
  if (!secret) throw new Error("ยังไม่ได้ตั้งค่า AUTH_SECRET");
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  return {
    name: COOKIE_NAME,
    value: await signSession({ uid: userId, exp, tv: tokenVersion }, secret),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_DAYS * 86400,
    },
  };
}
