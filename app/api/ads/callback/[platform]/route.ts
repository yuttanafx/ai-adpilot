import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AppError } from "@/lib/db";
import { withUser } from "@/lib/http";
import { appUrl, platformConfig, redirectUri } from "@/lib/ads/config";
import { saveToken, setAccount } from "@/lib/ads/connections";
import { metaAccounts, metaExchange } from "@/lib/ads/meta";
import { tiktokAccounts, tiktokExchange } from "@/lib/ads/tiktok";
import { CONN_LABEL, isConnPlatform } from "@/lib/ads/types";

type Ctx = { params: Promise<{ platform: string }> };

// ทุกทางออกต้องลบคุกกี้ state ทิ้ง (ใช้ได้ครั้งเดียว)
function go(req: Request, platform: string, query: string) {
  const res = NextResponse.redirect(new URL(`/?${query}#connections`, appUrl(req)));
  res.cookies.set("fx_oauth_" + platform, "", { path: "/api/ads/callback", maxAge: 0 });
  return res;
}
const fail = (req: Request, platform: string, msg: string) => go(req, platform, `ads_error=${encodeURIComponent(msg)}`);

function sameState(a: string | undefined, b: string | null): boolean {
  if (!a || !b || a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Meta / TikTok ส่งผู้ใช้กลับมาที่นี่พร้อม code → แลกเป็น token แล้วเก็บแบบเข้ารหัส
export const GET = withUser<Ctx>(async (req, user, ctx) => {
  const platform = (await ctx.params).platform;
  if (!isConnPlatform(platform)) throw new AppError("แพลตฟอร์มไม่ถูกต้อง", 400);
  const label = CONN_LABEL[platform];
  const q = new URL(req.url).searchParams;

  const expected = (await cookies()).get("fx_oauth_" + platform)?.value;

  if (q.get("error") || q.get("error_reason")) return fail(req, platform, `คุณยกเลิกหรือไม่ได้อนุญาตการเชื่อมต่อ ${label}`);
  if (!sameState(expected, q.get("state"))) return fail(req, platform, "คำขอเชื่อมต่อไม่ถูกต้องหรือหมดอายุ (state ไม่ตรง) กรุณาลองใหม่");

  const code = platform === "meta" ? q.get("code") : q.get("auth_code");
  const cfg = platformConfig(platform);
  if (!code || !cfg) return fail(req, platform, `เชื่อมต่อ ${label} ไม่สำเร็จ: ไม่ได้รับรหัสอนุญาต`);

  try {
    const { token, expiresAt } =
      platform === "meta"
        ? await metaExchange(cfg.appId, cfg.secret, redirectUri(req, platform), code)
        : await tiktokExchange(cfg.appId, cfg.secret, code);
    await saveToken(user.id, platform, token, expiresAt);

    // ถ้ามีบัญชีโฆษณาเดียว เลือกให้อัตโนมัติ
    const accounts = platform === "meta" ? await metaAccounts(token) : await tiktokAccounts(cfg.appId, cfg.secret, token);
    if (accounts.length === 1) await setAccount(user.id, platform, accounts[0]);
    return go(req, platform, `ads_connected=${platform}`);
  } catch (e) {
    if (!(e instanceof AppError)) console.error(e);
    return fail(req, platform, e instanceof AppError ? e.message : `เชื่อมต่อ ${label} ไม่สำเร็จ กรุณาลองใหม่`);
  }
});
