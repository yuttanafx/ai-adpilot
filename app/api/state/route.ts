import { AppError, getDb } from "@/lib/db";
import { json, readJson, withUser } from "@/lib/http";

const KEYS = ["queue", "log", "aiOn", "stopped"];

export const GET = withUser(async (req, user) => {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!KEYS.includes(key)) throw new AppError("key ไม่ถูกต้อง", 400);
  const rows = await (await getDb()).query("select value from user_state where user_id = $1 and key = $2", [user.id, key]);
  return json({ value: rows[0] ? JSON.parse(rows[0].value) : null });
});

export const PUT = withUser(async (req, user) => {
  const body = await readJson(req);
  const key = typeof body.key === "string" ? body.key : "";
  if (!KEYS.includes(key)) throw new AppError("key ไม่ถูกต้อง", 400);
  const value = JSON.stringify(body.value ?? null);
  if (value.length > 500_000) throw new AppError("ข้อมูลใหญ่เกินกำหนด", 413);
  await (await getDb()).query(
    `insert into user_state (user_id, key, value, updated_at) values ($1,$2,$3,$4)
     on conflict (user_id, key) do update set value = excluded.value, updated_at = excluded.updated_at`,
    [user.id, key, value, new Date().toISOString()],
  );
  return json({ ok: true });
});
