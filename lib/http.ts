import { NextResponse } from "next/server";
import { AppError } from "./db";
import { currentUser, type User } from "./session";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

function fail(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "เซิร์ฟเวอร์ผิดพลาด กรุณาลองใหม่อีกครั้ง" }, { status: 500 });
}

export function withUser<C = unknown>(fn: (req: Request, user: User, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      const user = await currentUser();
      if (!user) return json({ error: "กรุณาเข้าสู่ระบบก่อน" }, 401);
      return await fn(req, user, ctx);
    } catch (e) {
      return fail(e);
    }
  };
}

export function withAdmin<C = unknown>(fn: (req: Request, user: User, ctx: C) => Promise<Response>) {
  return withUser<C>(async (req, user, ctx) => {
    if (user.role !== "admin") return json({ error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" }, 403);
    return fn(req, user, ctx);
  });
}

export function publicHandler(fn: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      return await fn(req);
    } catch (e) {
      return fail(e);
    }
  };
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    throw new AppError("ข้อมูลที่ส่งมาไม่ใช่ JSON", 400);
  }
}

export const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function validPassword(pw: string) {
  if (pw.length < 8) throw new AppError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร", 400);
  if (pw.length > 128) throw new AppError("รหัสผ่านยาวเกินไป", 400);
}
