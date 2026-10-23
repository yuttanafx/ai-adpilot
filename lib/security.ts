import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { authSecret } from "./auth";

const scrypt = (pw: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) => scryptCb(pw, salt, len, (e, k) => (e ? reject(e) : resolve(k))));

export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const h = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${h.toString("base64")}`;
}

let dummy: Promise<string> | null = null;

export async function verifyPassword(pw: string, stored: string | null): Promise<boolean> {
  // ถ้าไม่พบผู้ใช้ ยังคำนวณแฮชหลอกเพื่อให้ใช้เวลาใกล้เคียงกัน
  const target = stored ?? (await (dummy ??= hashPassword("dummy-password")));
  const [alg, s, h] = target.split("$");
  if (alg !== "scrypt" || !s || !h) return false;
  const expected = Buffer.from(h, "base64");
  const got = await scrypt(pw, Buffer.from(s, "base64"), expected.length);
  return stored !== null && timingSafeEqual(got, expected);
}

// เข้ารหัส API key ของผู้ใช้ก่อนเก็บลงฐานข้อมูล (AES-256-GCM)
function encKey(): Buffer {
  const secret = process.env.KEY_SECRET || authSecret();
  if (!secret) throw new Error("ยังไม่ได้ตั้งค่า AUTH_SECRET");
  return createHash("sha256").update("fx-user-keys:" + secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", encKey(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(blob: string): string {
  const [iv, tag, ct] = blob.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", encKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generatePassword(len = 12): string {
  const bytes = randomBytes(len);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
