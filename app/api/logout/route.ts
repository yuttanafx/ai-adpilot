import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth";
import { sessionCookieOptions } from "@/lib/embed";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", sessionCookieOptions(0)); // ต้องใช้ attribute เดียวกับตอนตั้ง ไม่งั้นลบคุกกี้ไม่ออก
  return res;
}
