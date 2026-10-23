import { NextResponse } from "next/server";
import { AppError, getDb } from "@/lib/db";
import { readJson, validPassword, withUser } from "@/lib/http";
import { hashPassword, verifyPassword } from "@/lib/security";
import { makeSessionCookie } from "@/lib/session";

export const POST = withUser(async (req, user) => {
  const body = await readJson(req);
  const current = typeof body.current === "string" ? body.current : "";
  const next = typeof body.next === "string" ? body.next : "";
  const db = await getDb();
  const rows = await db.query("select password_hash from users where id = $1", [user.id]);
  if (!(await verifyPassword(current, rows[0]?.password_hash ?? null))) throw new AppError("รหัสผ่านปัจจุบันไม่ถูกต้อง", 400);
  validPassword(next);
  // เปลี่ยนรหัสผ่านแล้ว เซสชันเก่าบนอุปกรณ์อื่นจะใช้ไม่ได้อีก
  const tv = user.tokenVersion + 1;
  await db.query("update users set password_hash = $1, token_version = $2 where id = $3", [await hashPassword(next), tv, user.id]);
  const c = await makeSessionCookie(user.id, tv);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(c.name, c.value, c.options);
  return res;
});
