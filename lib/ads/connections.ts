import { getDb } from "../db";
import { decryptSecret, encryptSecret } from "../security";
import type { ConnPlatform } from "./types";

export type Conn = {
  platform: ConnPlatform;
  token: string;
  accountId: string;
  accountName: string;
  currency: string;
  status: "ok" | "reauth";
  expiresAt: string | null;
};

export type PublicConn = Omit<Conn, "token">;

type Row = Record<string, string | null>;

const toPublic = (r: Row): PublicConn => ({
  platform: r.platform as ConnPlatform,
  accountId: r.account_id ?? "",
  accountName: r.account_name ?? "",
  currency: r.currency ?? "",
  status: r.status === "reauth" ? "reauth" : "ok",
  expiresAt: r.expires_at ?? null,
});

export async function getConn(userId: string, platform: ConnPlatform): Promise<Conn | null> {
  const rows = await (await getDb()).query("select * from ad_connections where user_id = $1 and platform = $2", [userId, platform]);
  if (!rows[0]) return null;
  return { ...toPublic(rows[0]), token: decryptSecret(rows[0].enc) };
}

export async function listConns(userId: string): Promise<PublicConn[]> {
  const rows = await (await getDb()).query("select * from ad_connections where user_id = $1", [userId]);
  return rows.map(toPublic);
}

// เชื่อมต่อใหม่ = เปลี่ยน token และรีเซ็ตสถานะ แต่คงบัญชีโฆษณาที่เลือกไว้เดิม
export async function saveToken(userId: string, platform: ConnPlatform, token: string, expiresAt: string | null) {
  await (await getDb()).query(
    `insert into ad_connections (user_id, platform, enc, status, expires_at, updated_at) values ($1,$2,$3,'ok',$4,$5)
     on conflict (user_id, platform) do update set enc = excluded.enc, status = 'ok', expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
    [userId, platform, encryptSecret(token), expiresAt, new Date().toISOString()],
  );
}

export async function setAccount(userId: string, platform: ConnPlatform, a: { id: string; name: string; currency: string }) {
  await (await getDb()).query(
    "update ad_connections set account_id = $3, account_name = $4, currency = $5, updated_at = $6 where user_id = $1 and platform = $2",
    [userId, platform, a.id, a.name, a.currency, new Date().toISOString()],
  );
}

export async function markReauth(userId: string, platform: ConnPlatform) {
  await (await getDb()).query("update ad_connections set status = 'reauth', updated_at = $3 where user_id = $1 and platform = $2", [
    userId,
    platform,
    new Date().toISOString(),
  ]);
}

export async function deleteConn(userId: string, platform: ConnPlatform) {
  await (await getDb()).query("delete from ad_connections where user_id = $1 and platform = $2", [userId, platform]);
}
