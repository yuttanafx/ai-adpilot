import { AppError, getDb } from "@/lib/db";
import { json, readJson, str, withUser } from "@/lib/http";
import { isProvider } from "@/lib/providers";

export const PUT = withUser(async (req, user) => {
  const body = await readJson(req);
  if (!isProvider(body.provider)) throw new AppError("ผู้ให้บริการ AI ไม่ถูกต้อง", 400);
  const model = str(body.model, 80);
  if (model && !/^[A-Za-z0-9._:/-]+$/.test(model)) throw new AppError("ชื่อโมเดลมีอักขระที่ไม่อนุญาต", 400);
  await (await getDb()).query("update users set ai_provider = $1, ai_model = $2 where id = $3", [body.provider, model, user.id]);
  return json({ ok: true });
});
