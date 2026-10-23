import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/db";
import { withUser } from "@/lib/http";
import { appUrl, envNames, platformConfig, redirectUri } from "@/lib/ads/config";
import { metaAuthUrl } from "@/lib/ads/meta";
import { tiktokAuthUrl } from "@/lib/ads/tiktok";
import { CONN_LABEL, isConnPlatform } from "@/lib/ads/types";

type Ctx = { params: Promise<{ platform: string }> };

const back = (req: Request, msg: string) => NextResponse.redirect(new URL(`/?ads_error=${encodeURIComponent(msg)}#connections`, appUrl(req)));

// เริ่มขั้นตอน OAuth: พาผู้ใช้ไปหน้าอนุญาตของ Meta / TikTok
export const GET = withUser<Ctx>(async (req, _user, ctx) => {
  const platform = (await ctx.params).platform;
  if (!isConnPlatform(platform)) throw new AppError("แพลตฟอร์มไม่ถูกต้อง", 400);
  const cfg = platformConfig(platform);
  if (!cfg) return back(req, `ผู้ดูแลระบบยังไม่ได้ตั้งค่า ${envNames(platform)} บนเซิร์ฟเวอร์ จึงเชื่อมต่อ ${CONN_LABEL[platform]} ไม่ได้`);

  const state = randomBytes(24).toString("hex");
  const uri = redirectUri(req, platform);
  const url = platform === "meta" ? metaAuthUrl(cfg.appId, uri, state) : tiktokAuthUrl(cfg.appId, uri, state);

  const res = NextResponse.redirect(url);
  res.cookies.set("fx_oauth_" + platform, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/ads/callback",
    maxAge: 600,
  });
  return res;
});
