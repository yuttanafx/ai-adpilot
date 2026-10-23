import type { ConnPlatform } from "./types";

type Cfg = { appId: string; secret: string };

export function platformConfig(p: ConnPlatform): Cfg | null {
  const appId = (p === "meta" ? process.env.META_APP_ID : process.env.TIKTOK_APP_ID)?.trim();
  const secret = (p === "meta" ? process.env.META_APP_SECRET : process.env.TIKTOK_APP_SECRET)?.trim();
  return appId && secret ? { appId, secret } : null;
}

export const envNames = (p: ConnPlatform) => (p === "meta" ? "META_APP_ID / META_APP_SECRET" : "TIKTOK_APP_ID / TIKTOK_APP_SECRET");

// ฐาน URL ของเว็บ ต้องตรงกับ Redirect URI ที่ลงทะเบียนไว้กับ Meta / TikTok ทุกตัวอักษร
export function appUrl(req: Request): string {
  const env = process.env.APP_URL?.trim().replace(/\/+$/, "");
  if (env) return env;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export const redirectUri = (req: Request, p: ConnPlatform) => `${appUrl(req)}/api/ads/callback/${p}`;
