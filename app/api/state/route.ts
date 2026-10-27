import { AppError, getDb } from "@/lib/db";
import { getState, setState } from "@/lib/store";
import { json, readJson, withUser } from "@/lib/http";

const KEYS = ["queue", "log", "aiOn", "stopped"];

export const GET = withUser(async (req, user) => {
  const key = new URL(req.url).searchParams.get("key") ?? "";
  if (!KEYS.includes(key)) throw new AppError("key ไม่ถูกต้อง", 400);
  const raw = await getState(await getDb(), user.id, key);
  return json({ value: raw !== null ? JSON.parse(raw) : null });
});

export const PUT = withUser(async (req, user) => {
  const body = await readJson(req);
  const key = typeof body.key === "string" ? body.key : "";
  if (!KEYS.includes(key)) throw new AppError("key ไม่ถูกต้อง", 400);
  const value = JSON.stringify(body.value ?? null);
  if (Buffer.byteLength(value) > 900_000) throw new AppError("ข้อมูลใหญ่เกินกำหนด", 413);
  await setState(await getDb(), user.id, key, value); // Firestore จำกัด 1 MiB ต่อเอกสาร
  return json({ ok: true });
});
