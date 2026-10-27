import { NextResponse } from "next/server";
import { AppError, getDb } from "@/lib/db";
import { updateUser, userByUsername } from "@/lib/store";
import { publicHandler, readJson, str } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { verifyPassword } from "@/lib/security";
import { makeSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

export const POST = publicHandler(async (req) => {
  const body = await readJson(req);
  const username = str(body.username, 64).toLowerCase();
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";

  const ip = clientIp(req);
  const a = rateLimit("login-ip:" + ip, 30, 10 * 60_000);
  const b = rateLimit("login-user:" + username, 8, 10 * 60_000);
  if (!a.ok || !b.ok) {
    throw new AppError(`ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอ ${Math.max(a.retryAfter, b.retryAfter)} วินาที`, 429);
  }
  if (!username || !password) throw new AppError("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน", 400);

  const db = await getDb();
  const u = await userByUsername(db, username);
  const ok = await verifyPassword(password, u ? u.password_hash : null);
  if (!u || !ok || !u.active) throw new AppError("ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (หรือบัญชีถูกระงับ)", 401);

  await updateUser(db, u.id, { last_login: new Date().toISOString() });
  const c = await makeSessionCookie(u.id, u.token_version);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(c.name, c.value, c.options);
  return res;
});
