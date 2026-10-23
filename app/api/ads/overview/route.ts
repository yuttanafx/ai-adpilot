import { AppError } from "@/lib/db";
import { json, withUser } from "@/lib/http";
import { buildOverview } from "@/lib/ads/overview";
import { rateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

const ALLOWED = ["all", "meta", "google", "tiktok"];

// ข้อมูลจริง 7 วันล่าสุด (เทียบกับ 7 วันก่อนหน้า) จากบัญชีที่ผู้ใช้เชื่อมต่อ
export const GET = withUser(async (req, user) => {
  const rl = rateLimit("ads:" + user.id, 30, 60_000);
  if (!rl.ok) throw new AppError(`เรียกดูข้อมูลบ่อยเกินไป กรุณารอ ${rl.retryAfter} วินาที`, 429);
  const platform = new URL(req.url).searchParams.get("platform") ?? "all";
  if (!ALLOWED.includes(platform)) throw new AppError("แพลตฟอร์มไม่ถูกต้อง", 400);
  return json(await buildOverview(user.id, platform));
});
