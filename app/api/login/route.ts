import { NextResponse } from "next/server";
import { COOKIE_NAME, authConfigured, safeEqual, sessionToken } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า APP_PASSWORD" }, { status: 503 });
  }
  const rl = rateLimit("login:" + clientIp(req), 8, 10 * 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `ลองรหัสผ่านหลายครั้งเกินไป กรุณารอ ${rl.retryAfter} วินาที` }, { status: 429 });
  }
  let password = "";
  try {
    password = String((await req.json()).password ?? "");
  } catch {}
  if (!safeEqual(password, process.env.APP_PASSWORD as string)) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, await sessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
  });
  return res;
}
