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
      throw e;
    });
  }
  return g.__fxDb;
}

async function init(): Promise<Db> {
  let db: Db;
  if (process.env.DATABASE_URL) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
    db = { query: async (s, p) => (await pool.query(s, p as unknown[])).rows };
  } else {
    if (process.env.NODE_ENV === "production") {
      throw new AppError("ยังไม่ได้ตั้งค่า DATABASE_URL (ฐานข้อมูล Postgres) บนเซิร์ฟเวอร์", 503);
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
