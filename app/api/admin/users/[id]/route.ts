import { AppError, getDb } from "@/lib/db";
import { deleteUser, otherActiveAdmins as countOtherAdmins, updateUser, userById, type UserRow } from "@/lib/store";
import { json, readJson, str, validPassword, withAdmin } from "@/lib/http";
import { generatePassword, hashPassword } from "@/lib/security";

type Ctx = { params: Promise<{ id: string }> };

const otherActiveAdmins = async (excludeId: string) => countOtherAdmins(await getDb(), excludeId);

export const PATCH = withAdmin<Ctx>(async (req, me, ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  const db = await getDb();
  const target = await userById(db, id);
  if (!target) throw new AppError("ไม่พบผู้ใช้", 404);

  const set: Partial<UserRow> = {};
  let newPassword: string | undefined;
  let revoke = false;

  if (typeof body.displayName === "string") set.display_name = str(body.displayName, 80) || "ผู้ใช้";

  if (typeof body.active === "boolean" && body.active !== target.active) {
    if (id === me.id) throw new AppError("ไม่สามารถปิดบัญชีของตัวเองได้", 400);
    if (!body.active && target.role === "admin" && (await otherActiveAdmins(id)) < 1) throw new AppError("ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน", 400);
    set.active = body.active;
    if (!body.active) revoke = true;
  }

  if ((body.role === "admin" || body.role === "user") && body.role !== target.role) {
    if (id === me.id) throw new AppError("ไม่สามารถเปลี่ยนบทบาทของตัวเองได้", 400);
    if (body.role === "user" && target.role === "admin" && (await otherActiveAdmins(id)) < 1) throw new AppError("ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน", 400);
    set.role = body.role;
  }

  if (body.resetPassword === true || (typeof body.password === "string" && body.password)) {
    const supplied = typeof body.password === "string" ? body.password : "";
    if (supplied) validPassword(supplied);
    newPassword = supplied || generatePassword();
    set.password_hash = await hashPassword(newPassword);
    revoke = true;
  }

  if (revoke) set.token_version = target.token_version + 1; // ออกจากระบบทุกอุปกรณ์ของผู้ใช้นั้น
  if (!Object.keys(set).length) return json({ ok: true });
  await updateUser(db, id, set);
  return json({ ok: true, password: newPassword });
});

export const DELETE = withAdmin<Ctx>(async (_req, me, ctx) => {
  const { id } = await ctx.params;
  if (id === me.id) throw new AppError("ไม่สามารถลบบัญชีของตัวเองได้", 400);
  const db = await getDb();
  const target = await userById(db, id);
  if (!target) throw new AppError("ไม่พบผู้ใช้", 404);
  if (target.role === "admin" && (await otherActiveAdmins(id)) < 1) throw new AppError("ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน", 400);
  await deleteUser(db, id);
  return json({ ok: true });
});
