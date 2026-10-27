// ชั้นเก็บข้อมูลบน Firestore (เรียกผ่าน Firebase Admin ฝั่งเซิร์ฟเวอร์เท่านั้น)
//
// users/{uid}                    ข้อมูลผู้ใช้
// users/{uid}/api_keys/{provider}   API key ของ AI (เข้ารหัส)
// users/{uid}/ad_connections/{platform}  token Meta/TikTok (เข้ารหัส) — ดู lib/ads/connections.ts
// users/{uid}/state/{key}        คิว/บันทึก/สวิตช์ของผู้ใช้
// usernames/u_{username}         ดัชนีกันชื่อผู้ใช้ซ้ำ + ค้นหาตอนล็อกอิน
import { AppError, newId, type Db } from "./db";

export type UserRow = {
  id: string;
  username: string;
  display_name: string;
  role: "admin" | "user";
  password_hash: string;
  active: boolean;
  token_version: number;
  ai_provider: string;
  ai_model: string;
  created_at: string;
  last_login: string | null;
};

const nameKey = (username: string) => "u_" + username; // กัน id ที่ Firestore สงวนไว้ (เช่น __x__)
const toUser = (id: string, d: FirebaseFirestore.DocumentData): UserRow => ({
  id,
  username: d.username,
  display_name: d.display_name ?? d.username,
  role: d.role === "admin" ? "admin" : "user",
  password_hash: d.password_hash,
  active: d.active !== false,
  token_version: typeof d.token_version === "number" ? d.token_version : 0,
  ai_provider: d.ai_provider || "gemini",
  ai_model: d.ai_model || "",
  created_at: d.created_at,
  last_login: d.last_login ?? null,
});

const isCode = (e: unknown, code: number) => (e as { code?: number })?.code === code;
const ALREADY_EXISTS = 6;
const NOT_FOUND = 5;

// ---------- ผู้ใช้ ----------
export async function userById(db: Db, id: string): Promise<UserRow | null> {
  const s = await db.collection("users").doc(id).get();
  return s.exists ? toUser(s.id, s.data()!) : null;
}

export async function userByUsername(db: Db, username: string): Promise<UserRow | null> {
  const n = await db.collection("usernames").doc(nameKey(username)).get();
  if (!n.exists) return null;
  return userById(db, String(n.data()!.uid));
}

export async function listUsers(db: Db): Promise<UserRow[]> {
  const s = await db.collection("users").orderBy("created_at").get();
  return s.docs.map((d) => toUser(d.id, d.data()));
}

export async function anyAdmin(db: Db): Promise<boolean> {
  return !(await db.collection("users").where("role", "==", "admin").limit(1).get()).empty;
}

export async function otherActiveAdmins(db: Db, excludeId: string): Promise<number> {
  const s = await db.collection("users").where("role", "==", "admin").get();
  return s.docs.filter((d) => d.id !== excludeId && d.data().active !== false).length;
}

export async function createUser(db: Db, u: { username: string; displayName: string; role: "admin" | "user"; passwordHash: string }): Promise<string> {
  const id = newId();
  const idx = db.collection("usernames").doc(nameKey(u.username));
  try {
    await idx.create({ uid: id }); // create() ล้มเหลวถ้ามีอยู่แล้ว = กันชื่อซ้ำแบบ atomic
  } catch (e) {
    if (isCode(e, ALREADY_EXISTS)) throw new AppError("มีชื่อผู้ใช้นี้อยู่แล้ว", 409);
    throw e;
  }
  try {
    await db.collection("users").doc(id).set({
      username: u.username,
      display_name: u.displayName,
      role: u.role,
      password_hash: u.passwordHash,
      active: true,
      token_version: 0,
      ai_provider: "gemini",
      ai_model: "",
      created_at: new Date().toISOString(),
      last_login: null,
    });
  } catch (e) {
    await idx.delete().catch(() => {});
    throw e;
  }
  return id;
}

export async function updateUser(db: Db, id: string, fields: Partial<Omit<UserRow, "id" | "username" | "created_at">>) {
  await db.collection("users").doc(id).update(fields);
}

export async function deleteUser(db: Db, id: string) {
  const u = await userById(db, id);
  if (!u) return;
  await db.recursiveDelete(db.collection("users").doc(id)); // ลบข้อมูลย่อยทั้งหมด (คีย์ การเชื่อมต่อ คิว)
  await db.collection("usernames").doc(nameKey(u.username)).delete();
}

// ---------- API key ของ AI ----------
export async function keyProviders(db: Db, userId: string): Promise<{ provider: string; last4: string }[]> {
  const s = await db.collection("users").doc(userId).collection("api_keys").get();
  return s.docs.map((d) => ({ provider: d.id, last4: String(d.data().last4 ?? "") }));
}

export async function allKeyProviders(db: Db): Promise<{ user_id: string; provider: string }[]> {
  const s = await db.collectionGroup("api_keys").get();
  return s.docs.map((d) => ({ user_id: String(d.data().user_id), provider: d.id }));
}

export async function getKeyEnc(db: Db, userId: string, provider: string): Promise<string | null> {
  const s = await db.collection("users").doc(userId).collection("api_keys").doc(provider).get();
  return s.exists ? String(s.data()!.enc) : null;
}

export async function setKey(db: Db, userId: string, provider: string, enc: string, last4: string) {
  await db.collection("users").doc(userId).collection("api_keys").doc(provider).set({ user_id: userId, enc, last4, updated_at: new Date().toISOString() });
}

export async function deleteKey(db: Db, userId: string, provider: string) {
  await db.collection("users").doc(userId).collection("api_keys").doc(provider).delete();
}

// ---------- สถานะแอป (คิว บันทึก สวิตช์) ----------
export async function getState(db: Db, userId: string, key: string): Promise<string | null> {
  const s = await db.collection("users").doc(userId).collection("state").doc(key).get();
  return s.exists ? String(s.data()!.value) : null;
}

export async function setState(db: Db, userId: string, key: string, value: string) {
  await db.collection("users").doc(userId).collection("state").doc(key).set({ value, updated_at: new Date().toISOString() });
}

export { NOT_FOUND };
