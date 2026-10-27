import { AppError, getDb } from "@/lib/db";
import { allKeyProviders, createUser, listUsers } from "@/lib/store";
import { json, readJson, str, validPassword, withAdmin } from "@/lib/http";
import { generatePassword, hashPassword } from "@/lib/security";

export const GET = withAdmin(async () => {
  const db = await getDb();
  const users = await listUsers(db);
  const keys = await allKeyProviders(db);
  return json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.display_name,
      role: u.role,
      active: u.active,
      createdAt: u.created_at,
      lastLogin: u.last_login,
      provider: u.ai_provider,
      keysSet: keys.filter((k) => k.user_id === u.id).map((k) => k.provider),
    })),
  });
});

export const POST = withAdmin(async (req) => {
  const body = await readJson(req);
  const username = str(body.username, 32).toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new AppError("ชื่อผู้ใช้ต้องเป็นตัวอักษรอังกฤษ/ตัวเลข . _ - ยาว 3–32 ตัว", 400);
  const displayName = str(body.displayName, 80) || username;
  const role = body.role === "admin" ? "admin" : "user";
  const supplied = typeof body.password === "string" && body.password.length > 0 ? body.password : "";
  if (supplied) validPassword(supplied);
  const password = supplied || generatePassword();
  const db = await getDb();
  await createUser(db, { username, displayName, role, passwordHash: await hashPassword(password) }); // ชื่อซ้ำ → 409
  // แสดงรหัสผ่านครั้งเดียวตอนสร้าง (เก็บในระบบเป็นแฮชเท่านั้น ดูย้อนหลังไม่ได้)
  return json({ ok: true, username, password }, 201);
});
