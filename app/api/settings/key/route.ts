import { AppError, getDb } from "@/lib/db";
import { json, readJson, withUser } from "@/lib/http";
import { isProvider } from "@/lib/providers";
import { encryptSecret } from "@/lib/security";

export const PUT = withUser(async (req, user) => {
  const body = await readJson(req);
  if (!isProvider(body.provider)) throw new AppError("ผู้ให้บริการ AI ไม่ถูกต้อง", 400);
  const key = typeof body.key === "string" ? body.key.trim() : "";
  if (key.length < 10 || key.length > 400 || /\s/.test(key)) throw new AppError("API key ไม่ถูกต้อง (ต้องไม่มีช่องว่าง และยาวอย่างน้อย 10 ตัวอักษร)", 400);
  await (await getDb()).query(
    `insert into user_keys (user_id, provider, enc, last4, updated_at) values ($1,$2,$3,$4,$5)
     on conflict (user_id, provider) do update set enc = excluded.enc, last4 = excluded.last4, updated_at = excluded.updated_at`,
    [user.id, body.provider, encryptSecret(key), key.slice(-4), new Date().toISOString()],
  );
  return json({ ok: true });
});

export const DELETE = withUser(async (req, user) => {
  const provider = new URL(req.url).searchParams.get("provider");
  if (!isProvider(provider)) throw new AppError("ผู้ให้บริการ AI ไม่ถูกต้อง", 400);
  await (await getDb()).query("delete from user_keys where user_id = $1 and provider = $2", [user.id, provider]);
  return json({ ok: true });
});
