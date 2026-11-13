import { NextResponse } from "next/server";
import { AppError, getDb } from "@/lib/db";
import { createUser } from "@/lib/store";
import { json, publicHandler, readJson, str, validPassword } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/rateLimit";
import { hashPassword } from "@/lib/security";
import { makeSessionCookie } from "@/lib/session";

export const runtime = "nodejs";

// เปิดให้สมัครเองเป็นค่าเริ่มต้น ตั้ง SIGNUP_DISABLED=1 บนเซิร์ฟเวอร์เพื่อปิด (กลับไปให้แอดมินสร้างบัญชีให้)
const signupOpen = () => process.env.SIGNUP_DISABLED !== "1";

// หน้าล็อกอินใช้ถามว่าเปิดสมัครอยู่หรือไม่ เพื่อแสดงลิงก์ “สมัครสมาชิก”
export const GET = publicHandler(async () => json({ open: signupOpen() }));

export const POST = publicHandler(async (req) => {
  if (!signupOpen()) throw new AppError("ขณะนี้ปิดรับสมัครสมาชิกเอง กรุณาติดต่อผู้ดูแลระบบ", 403);

  const body = await readJson(req);
  const username = str(body.username, 32).toLowerCase();
  const displayName = str(body.displayName, 80) || username;
  const password = typeof body.password === "string" ? body.password : "";

  const rl = rateLimit("register-ip:" + clientIp(req), 8, 60 * 60_000);
  if (!rl.ok) throw new AppError(`สมัครหลายครั้งเกินไป กรุณารอ ${rl.retryAfter} วินาที`, 429);

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new AppError("ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข . _ - ยาว 3–32 ตัว", 400);
  }
  validPassword(password);

  const db = await getDb();
  // บัญชีที่สมัครเองเป็น "user" เสมอ (ตั้งเป็นแอดมินได้เฉพาะโดยแอดมินที่หน้า /admin)
  const id = await createUser(db, { username, displayName, role: "user", passwordHash: await hashPassword(password) }); // ชื่อซ้ำ → 409

  // ล็อกอินให้ทันทีหลังสมัครสำเร็จ
  const c = await makeSessionCookie(id, 0);
  const res = NextResponse.json({ ok: true }, { status: 201 });
  res.cookies.set(c.name, c.value, c.options);
  return res;
});
