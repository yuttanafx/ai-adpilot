import { hashPassword } from "./security";

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export type Db = { query: (sql: string, params?: unknown[]) => Promise<Row[]> };

const g = globalThis as unknown as { __fxDb?: Promise<Db> };

export class AppError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function getDb(): Promise<Db> {
  if (!g.__fxDb) {
    g.__fxDb = init().catch((e) => {
      g.__fxDb = undefined;
      if (e instanceof AppError) throw e;
      console.error("[db] เริ่มต้นฐานข้อมูลไม่สำเร็จ", e);
      // แสดงเฉพาะรหัส error (ไม่รวมข้อความที่อาจมีชื่อโฮสต์/ผู้ใช้) เพื่อให้ตรวจสอบสาเหตุได้
      const code = typeof e?.code === "string" ? e.code : "UNKNOWN";
      throw new AppError(`เชื่อมต่อหรือเตรียมฐานข้อมูลไม่สำเร็จ (รหัส ${code}) ตรวจสอบ DATABASE_URL / POSTGRES_URL และดู log บน Vercel`, 503, "DB");
    });
  }
  return g.__fxDb;
}

const CERT_ERRORS = ["SELF_SIGNED_CERT_IN_CHAIN", "DEPTH_ZERO_SELF_SIGNED_CERT", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"];

// พารามิเตอร์ sslmode / supa ที่ Vercel ใส่มาทำให้ pg บังคับตรวจใบรับรองแบบเข้มและพังกับ pooler บางเจ้า จึงตัดออกแล้วกำหนด ssl เอง
function cleanUrl(u: string): string {
  try {
    const x = new URL(u);
    x.searchParams.delete("sslmode");
    x.searchParams.delete("supa");
    return x.toString();
  } catch {
    return u;
  }
}

async function connectPg(url: string): Promise<Db> {
  const { Pool } = await import("pg");
  const conn = cleanUrl(url);
  const local = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(conn);
  const mk = (ssl: boolean | { rejectUnauthorized: boolean }) =>
    new Pool({ connectionString: conn, max: 5, ssl: local ? undefined : ssl, connectionTimeoutMillis: 10_000 });
  let pool = mk(true); // ตรวจใบรับรองเต็มรูปแบบก่อน
  try {
    await pool.query("select 1");
  } catch (e) {
    const code = (e as { code?: string })?.code ?? "";
    if (!CERT_ERRORS.includes(code)) throw e;
    // ผู้ให้บริการบางรายใช้ CA ที่ Node ไม่รู้จัก: ยังเข้ารหัสการเชื่อมต่ออยู่ แต่ไม่ตรวจห่วงโซ่ใบรับรอง
    console.warn("[db] ตรวจใบรับรอง SSL ไม่ผ่าน (" + code + ") ลองใหม่แบบ rejectUnauthorized=false");
    await pool.end().catch(() => {});
    pool = mk({ rejectUnauthorized: false });
    await pool.query("select 1");
  }
  return { query: async (s, p) => (await pool.query(s, p as unknown[])).rows };
}

async function init(): Promise<Db> {
  let db: Db;
  // รองรับทั้ง DATABASE_URL และตัวแปรที่ Vercel / Neon สร้างให้อัตโนมัติ (POSTGRES_URL ฯลฯ)
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING;
  if (dbUrl) {
    db = await connectPg(dbUrl);
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("ยังไม่ได้ตั้งค่า DATABASE_URL หรือ POSTGRES_URL (ฐานข้อมูล Postgres) บนเซิร์ฟเวอร์", 503);
    }
    // โหมดพัฒนาในเครื่อง: ใช้ Postgres แบบฝัง เก็บไฟล์ไว้ที่ .data/
    const { PGlite } = await import("@electric-sql/pglite");
    const { mkdirSync } = await import("node:fs");
    mkdirSync("./.data", { recursive: true });
    const pg = new PGlite("./.data/pglite");
    db = { query: async (s, p) => (await pg.query(s, p as unknown[])).rows as Row[] };
  }
  await migrate(db);
  await seedAdmin(db);
  return db;
}

async function migrate(db: Db) {
  await db.query(`create table if not exists users (
    id text primary key,
    username text unique not null,
    display_name text not null,
    role text not null default 'user',
    password_hash text not null,
    active boolean not null default true,
    token_version integer not null default 0,
    ai_provider text not null default 'gemini',
    ai_model text not null default '',
    created_at text not null,
    last_login text
  )`);
  await db.query(`create table if not exists user_keys (
    user_id text not null references users(id) on delete cascade,
    provider text not null,
    enc text not null,
    last4 text not null,
    updated_at text not null,
    primary key (user_id, provider)
  )`);
  // การเชื่อมต่อบัญชีโฆษณา (Meta / TikTok) ต่อผู้ใช้ — token เข้ารหัส AES-256-GCM เช่นเดียวกับ API key ของ AI
  await db.query(`create table if not exists ad_connections (
    user_id text not null references users(id) on delete cascade,
    platform text not null,
    enc text not null,
    account_id text not null default '',
    account_name text not null default '',
    currency text not null default '',
    status text not null default 'ok',
    expires_at text,
    updated_at text not null,
    primary key (user_id, platform)
  )`);
  await db.query(`create table if not exists user_state (
    user_id text not null references users(id) on delete cascade,
    key text not null,
    value text not null,
    updated_at text not null,
    primary key (user_id, key)
  )`);
}

export const newId = () => crypto.randomUUID();

async function seedAdmin(db: Db) {
  const admins = await db.query("select id from users where role = 'admin' limit 1");
  if (admins.length) return;
  const dev = process.env.NODE_ENV !== "production";
  const username = (process.env.ADMIN_USERNAME || (dev ? "admin" : "")).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (dev ? "admin12345" : "");
  if (!username || password.length < 8) {
    console.error("ยังไม่มีแอดมิน: ตั้ง ADMIN_USERNAME และ ADMIN_PASSWORD (อย่างน้อย 8 ตัวอักษร) แล้วรีสตาร์ต");
    return;
  }
  if (dev && !process.env.ADMIN_PASSWORD) console.warn("[dev] สร้างแอดมินเริ่มต้น admin / admin12345 (ใช้เฉพาะในเครื่อง)");
  await db.query(
    "insert into users (id, username, display_name, role, password_hash, created_at) values ($1,$2,$3,'admin',$4,$5) on conflict (username) do nothing",
    [newId(), username, "ผู้ดูแลระบบ", await hashPassword(password), new Date().toISOString()],
  );
}
