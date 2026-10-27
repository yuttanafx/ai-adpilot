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

// users/{uid}/ad_connections/{platform} — token เข้ารหัส AES-256-GCM เช่นเดียวกับ API key ของ AI
const col = async (userId: string) => (await getDb()).collection("users").doc(userId).collection("ad_connections");

const toPublic = (platform: string, d: FirebaseFirestore.DocumentData): PublicConn => ({
  platform: platform as ConnPlatform,
  accountId: d.account_id ?? "",
  accountName: d.account_name ?? "",
  currency: d.currency ?? "",
  status: d.status === "reauth" ? "reauth" : "ok",
  expiresAt: d.expires_at ?? null,
});

export async function getConn(userId: string, platform: ConnPlatform): Promise<Conn | null> {
  const s = await (await col(userId)).doc(platform).get();
  if (!s.exists) return null;
  const d = s.data()!;
  return { ...toPublic(platform, d), token: decryptSecret(String(d.enc)) };
}

export async function listConns(userId: string): Promise<PublicConn[]> {
  const s = await (await col(userId)).get();
  return s.docs.map((d) => toPublic(d.id, d.data()));
}

// เชื่อมต่อใหม่ = เปลี่ยน token และรีเซ็ตสถานะ แต่คงบัญชีโฆษณาที่เลือกไว้เดิม (merge)
export async function saveToken(userId: string, platform: ConnPlatform, token: string, expiresAt: string | null) {
  await (await col(userId)).doc(platform).set({ enc: encryptSecret(token), status: "ok", expires_at: expiresAt, updated_at: new Date().toISOString() }, { merge: true });
}

export async function setAccount(userId: string, platform: ConnPlatform, a: { id: string; name: string; currency: string }) {
  await (await col(userId)).doc(platform).set({ account_id: a.id, account_name: a.name, currency: a.currency, updated_at: new Date().toISOString() }, { merge: true });
}

export async function markReauth(userId: string, platform: ConnPlatform) {
  try {
    await (await col(userId)).doc(platform).update({ status: "reauth", updated_at: new Date().toISOString() });
  } catch (e) {
    if ((e as { code?: number })?.code !== 5) throw e; // ไม่มีเอกสาร = ถูกตัดการเชื่อมต่อไปแล้ว
  }
}

export async function deleteConn(userId: string, platform: ConnPlatform) {
  await (await col(userId)).doc(platform).delete();
}
