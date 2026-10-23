import { AppError, getDb } from "@/lib/db";
import { json, readJson, str, validPassword, withAdmin } from "@/lib/http";
import { generatePassword, hashPassword } from "@/lib/security";

type Ctx = { params: Promise<{ id: string }> };

async function otherActiveAdmins(excludeId: string) {
  const rows = await (await getDb()).query("select count(*)::int as n from users where role = 'admin' and active = true and id <> $1", [excludeId]);
  return rows[0].n as number;
}

export const PATCH = withAdmin<Ctx>(async (req, me, ctx) => {
  const { id } = await ctx.params;
  const body = await readJson(req);
  const db = await getDb();
  const rows = await db.query("select id, role, active, token_version from users where id = $1", [id]);
  const target = rows[0];
  if (!target) throw new AppError("ไม่พบผู้ใช้", 404);

  const sets: string[] = [];
  const vals: unknown[] = [];
  const add = (col: string, v: unknown) => {
    vals.push(v);
    sets.push(`${col} = $${vals.length}`);
  };
  let newPassword: string | undefined;
  let revoke = false;

  if (typeof body.displayName === "string") add("display_name", str(body.displayName, 80) || "ผู้ใช้");

  if (typeof body.active === "boolean" && body.active !== target.active) {
    if (id === me.id) throw new AppError("ไม่สามารถปิดบัญชีของตัวเองได้", 400);
    if (!body.active && target.role === "admin" && (await otherActiveAdmins(id)) < 1) throw new AppError("ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน", 400);
    add("active", body.active);
    if (!body.active) revoke = true;
  }

  if ((body.role === "admin" || body.role === "user") && body.role !== target.role) {
    if (id === me.id) throw new AppError("ไม่สามารถเปลี่ยนบทบาทของตัวเองได้", 400);
    if (body.role === "user" && target.role === "admin" && (await otherActiveAdmins(id)) < 1) throw new AppError("ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน", 400);
    add("role", body.role);
  }

  if (body.resetPassword === true || (typeof body.password === "string" && body.password)) {
    const supplied = typeof body.password === "string" ? body.password : "";
    if (supplied) validPassword(supplied);
    newPassword = supplied || generatePassword();
    add("password_hash", await hashPassword(newPassword));
    revoke = true;
  }

  if (revoke) add("token_version", target.token_version + 1); // ออกจากระบบทุกอุปกรณ์ของผู้ใช้นั้น
  if (!sets.length) return json({ ok: true });
  vals.push(id);
  await db.query(`update users set ${sets.join(", ")} where id = $${vals.length}`, vals);
  return json({ ok: true, password: newPassword });
});

export const DELETE = withAdmin<Ctx>(async (_req, me, ctx) => {
  const { id } = await ctx.params;
  if (id === me.id) throw new AppError("ไม่สามารถลบบัญชีของตัวเองได้", 400);
  const db = await getDb();
  const rows = await db.query("select role from users where id = $1", [id]);
  if (!rows[0]) throw new AppError("ไม่พบผู้ใช้", 404);
  if (rows[0].role === "admin" && (await otherActiveAdmins(id)) < 1) throw new AppError("ต้องเหลือแอดมินที่ใช้งานได้อย่างน้อย 1 คน", 400);
  await db.query("delete from users where id = $1", [id]);
  return json({ ok: true });
});
