import { AppError } from "@/lib/db";
import { json, withUser } from "@/lib/http";
import { platformConfig } from "@/lib/ads/config";
import { getConn, markReauth } from "@/lib/ads/connections";
import { metaAccounts } from "@/lib/ads/meta";
import { tiktokAccounts } from "@/lib/ads/tiktok";
import { AdAuthError, isConnPlatform } from "@/lib/ads/types";

export const runtime = "nodejs";
export const maxDuration = 60;

// รายชื่อบัญชีโฆษณาที่ผู้ใช้เลือกได้ในแพลตฟอร์มนั้น
export const GET = withUser(async (req, user) => {
  const platform = new URL(req.url).searchParams.get("platform");
  if (!isConnPlatform(platform)) throw new AppError("แพลตฟอร์มไม่ถูกต้อง", 400);
  const conn = await getConn(user.id, platform);
  const cfg = platformConfig(platform);
  if (!conn || !cfg) throw new AppError("ยังไม่ได้เชื่อมต่อแพลตฟอร์มนี้", 400);
  try {
    const accounts = platform === "meta" ? await metaAccounts(conn.token) : await tiktokAccounts(cfg.appId, cfg.secret, conn.token);
    return json({ accounts });
  } catch (e) {
    if (e instanceof AdAuthError) await markReauth(user.id, platform);
    throw e;
  }
});
