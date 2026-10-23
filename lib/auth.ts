// ส่วนที่ใช้ได้ทั้ง Edge middleware และ Node: ลงชื่อ/ตรวจคุกกี้เซสชัน (HMAC-SHA256)
export const COOKIE_NAME = "fx_session";
export const SESSION_DAYS = 14;

export type SessionPayload = { uid: string; exp: number; tv: number };

// AUTH_SECRET จำเป็นบน production; ตอนพัฒนาในเครื่องใช้ค่าสำรอง
export function authSecret(): string | null {
  if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 16) return process.env.AUTH_SECRET;
  if (process.env.NODE_ENV !== "production") return "dev-only-insecure-secret-change-me";
  return null;
}

const enc = new TextEncoder();

function toB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}

function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export async function signSession(payload: SessionPayload, secret: string): Promise<string> {
  const body = toB64url(enc.encode(JSON.stringify(payload)));
  return body + "." + toB64url(await hmac(secret, body));
}

export async function verifySession(token: string | undefined, secret: string): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    if (!equal(await hmac(secret, body), fromB64url(sig))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64url(body))) as SessionPayload;
    if (typeof p.uid !== "string" || typeof p.exp !== "number" || typeof p.tv !== "number") return null;
    if (p.exp < Date.now() / 1000) return null;
    return p;
  } catch {
    return null;
  }
}
