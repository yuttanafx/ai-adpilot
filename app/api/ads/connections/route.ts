import { AppError } from "@/lib/db";
import { json, readJson, withUser } from "@/lib/http";
import { platformConfig } from "@/lib/ads/config";
import { deleteConn, getConn, listConns, markReauth, setAccount } from "@/lib/ads/connections";
import { metaAccounts } from "@/lib/ads/meta";
import { tiktokAccounts } from "@/lib/ads/tiktok";
import { AdAuthError, CONN_LABEL, CONN_PLATFORMS, isConnPlatform } from "@/lib/ads/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = withUser(async (_req, user) => {
  const conns = await listConns(user.id);
  const now = Date.now();
  return json({
    items: CONN_PLATFORMS.map((p) => {
      const c = conns.find((x) => x.platform === p);
      const expired = c?.expiresAt ? new Date(c.expiresAt).getTime() < now : false;
      return {
        platform: p,
        label: CONN_LABEL[p],
        configured: Boolean(platformConfig(p)), // ผู้ดูแลตั้ง App ID/Secret บนเซิร์ฟเวอร์แล้วหรือยัง
        connected: Boolean(c),
        status: !c ? null : c.status === "reauth" || expired ? "reauth" : "ok",
        accountId: c?.accountId ?? "",
        accountName: c?.accountName ?? "",
        currency: c?.currency ?? "",
        expiresAt: c?.expiresAt ?? null,
      };
    }),
  });
});

// เลือกบัญชีโฆษณาที่จะดึงข้อมูล (ตรวจว่าเป็นบัญชีที่ผู้ใช้เข้าถึงได้จริง)
export const PUT = withUser(async (req, user) => {
  const body = await readJson(req);
  const platform = body.platform;
  const accountId = typeof body.accountId === "string" ? body.accountId.trim() : "";
  if (!isConnPlatform(platform) || !accountId) throw new AppError("ข้อมูลไม่ครบ", 400);
  const conn = await getConn(user.id, platform);
  const cfg = platformConfig(platform);
  if (!conn || !cfg) throw new AppError("ยังไม่ได้เชื่อมต่อแพลตฟอร์มนี้", 400);
  try {
    const accounts = platform === "meta" ? await metaAccounts(conn.token) : await tiktokAccounts(cfg.appId, cfg.secret, conn.token);
    const hit = accounts.find((a) => a.id === accountId);
    if (!hit) throw new AppError("ไม่พบบัญชีโฆษณานี้ในสิทธิ์ของคุณ", 400);
    await setAccount(user.id, platform, hit);
  } catch (e) {
    if (e instanceof AdAuthError) await markReauth(user.id, platform);
    throw e;
  }
  return json({ ok: true });
});

export const DELETE = withUser(async (req, user) => {
  const platform = new URL(req.url).searchParams.get("platform");
  if (!isConnPlatform(platform)) throw new AppError("แพลตฟอร์มไม่ถูกต้อง", 400);
  await deleteConn(user.id, platform);
  return json({ ok: true });
});
