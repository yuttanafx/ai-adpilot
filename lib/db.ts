import type { Firestore } from "firebase-admin/firestore";
import { hashPassword } from "./security";

export type Db = Firestore;

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

export const newId = () => crypto.randomUUID();

type Cred = { projectId: string; clientEmail: string; privateKey: string };

type SA = { project_id?: string; client_email?: string; private_key?: string };

// แปลงค่า FIREBASE_SERVICE_ACCOUNT ให้เป็นอ็อบเจ็กต์ — ทนต่อการวางที่ผิดรูปแบบที่พบบ่อย:
// มีเครื่องหมายคำพูดครอบ, เป็น base64, JSON ซ้อน (ถูก escape ซ้ำ), หรือบรรทัดใหม่จริงๆ แทรกอยู่ใน private_key
function parseServiceAccount(raw: string): SA | null {
  let t = raw.trim();
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith("`") && t.endsWith("`"))) t = t.slice(1, -1).trim();
  if (!t.startsWith("{") && !t.startsWith('"')) {
    try {
      const d = Buffer.from(t, "base64").toString("utf8").trim();
      if (d.startsWith("{")) t = d;
    } catch {
      /* ใช้ข้อความเดิม */
    }
  }
  const tryParse = (x: string): SA | null => {
    try {
      let v: unknown = JSON.parse(x);
      if (typeof v === "string") v = JSON.parse(v); // JSON ที่ถูกห่อเป็นสตริงซ้ำ
      return v && typeof v === "object" ? (v as SA) : null;
    } catch {
      return null;
    }
  };
  const direct = tryParse(t) ?? tryParse(t.replace(/\r?\n/g, "\\n")); // บรรทัดใหม่จริงๆ ในสตริง → \n
  if (direct?.private_key) return direct;
  // วิธีสุดท้าย: ดึงฟิลด์ที่ต้องใช้ออกมาด้วย regex แม้โครงสร้าง JSON พัง
  const pick = (k: string) => new RegExp(`"${k}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,|\\})`).exec(t)?.[1];
  const key = pick("private_key");
  const mail = pick("client_email");
  const pid = pick("project_id");
  return key && mail && pid ? { project_id: pid, client_email: mail, private_key: key } : direct;
}

// ตรวจรูปแบบ private key และแก้ \n ที่ถูก escape ให้เป็นบรรทัดใหม่จริง
function normalizeKey(k: string): string {
  return k.replace(/\\n/g, "\n").replace(/\r/g, "").trim();
}

// อ่านข้อมูลรับรอง Firebase: FIREBASE_SERVICE_ACCOUNT (JSON หรือ base64 ของ JSON) หรือแยก 3 ตัวแปร
function readCredentials(): Cred | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (raw) {
    const j = parseServiceAccount(raw);
    // ข้อมูลวินิจฉัยที่ไม่เปิดเผยความลับ: ความยาว และอักขระแรก/สุดท้าย
    const info = `ได้รับ ${raw.length} ตัวอักษร ขึ้นต้นด้วย "${raw[0]}" ลงท้ายด้วย "${raw[raw.length - 1]}" (ไฟล์ที่ถูกต้องยาวราว 2,300–2,500 ตัว ขึ้นต้นด้วย "{" ลงท้ายด้วย "}")`;
    if (!j) throw new AppError(`FIREBASE_SERVICE_ACCOUNT ไม่ใช่ JSON ที่ถูกต้อง — ${info} ให้เปิดไฟล์ .json ด้วย Notepad กดเลือกทั้งหมดแล้วคัดลอกมาวางทั้งไฟล์ ห้ามพิมพ์ครอบหรือแก้ไข`, 503, "FIREBASE_CONFIG");
    if (!j.project_id || !j.client_email || !j.private_key) {
      throw new AppError(`FIREBASE_SERVICE_ACCOUNT ขาด project_id / client_email / private_key — ${info}`, 503, "FIREBASE_CONFIG");
    }
    const privateKey = normalizeKey(j.private_key);
    if (!privateKey.includes("BEGIN PRIVATE KEY") || !privateKey.includes("END PRIVATE KEY")) {
      throw new AppError(`private_key ไม่สมบูรณ์ (ไม่พบ BEGIN/END PRIVATE KEY) — ${info}`, 503, "FIREBASE_CONFIG");
    }
    return { projectId: j.project_id, clientEmail: j.client_email, privateKey };
  }
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey: normalizeKey(privateKey.replace(/^"|"$/g, "")) };
  }
  return null;
}

const relatedEnvNames = () => Object.keys(process.env).filter((k) => /FIREBASE|FIRESTORE|GOOGLE|GCP/i.test(k)).slice(0, 12);

async function connect(): Promise<Db> {
  const emulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  const cred = readCredentials();

  if (!cred && !emulator) {
    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        `ยังไม่ได้ตั้งค่า Firebase (FIREBASE_SERVICE_ACCOUNT) บนเซิร์ฟเวอร์ — สภาพแวดล้อมที่รันอยู่: ${process.env.VERCEL_ENV || process.env.NODE_ENV}; ` +
          `ตัวแปรที่เกี่ยวข้องที่เห็น: ${relatedEnvNames().join(", ") || "ไม่มีเลย"} (ต้องติ๊ก Environment ให้ตรงกับสภาพแวดล้อมนี้ แล้ว Redeploy)`,
        503,
        "FIREBASE_CONFIG",
      );
    }
    // โหมดพัฒนาในเครื่องโดยไม่มี Firebase: เก็บในหน่วยความจำ + ไฟล์ .data/dev-store.json (ใช้เฉพาะตอนพัฒนา)
    const { createMemoryDb } = await import("./memstore");
    console.warn("[dev] ไม่พบ FIREBASE_SERVICE_ACCOUNT — ใช้ที่เก็บข้อมูลจำลองใน .data/dev-store.json (ไม่ใช่ Firebase จริง)");
    return createMemoryDb() as unknown as Db;
  }

  const { cert, getApps, initializeApp } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");
  const fresh = getApps().length === 0;
  const app = fresh
    ? initializeApp(
        cred
          ? { credential: cert({ projectId: cred.projectId, clientEmail: cred.clientEmail, privateKey: cred.privateKey }), projectId: cred.projectId }
          : { projectId: process.env.FIREBASE_PROJECT_ID || "demo-adpilot" },
      )
      : getApps()[0];
  const db = getFirestore(app);
  if (fresh) db.settings({ ignoreUndefinedProperties: true });
  return db;
}

const HINTS: Record<number, string> = {
  5: "ยังไม่ได้สร้างฐานข้อมูล Firestore ในโปรเจกต์นี้ (Firebase Console → Build → Firestore Database → Create database แบบ Native mode)",
  7: "service account ไม่มีสิทธิ์ใช้ Firestore หรือยังไม่ได้เปิด Cloud Firestore API ของโปรเจกต์",
  16: "service account หรือ private key ไม่ถูกต้อง/ถูกเพิกถอน ให้สร้างคีย์ใหม่",
  14: "เข้าถึงเซิร์ฟเวอร์ Firestore ไม่ได้ (เครือข่าย หรือ FIRESTORE_EMULATOR_HOST ชี้ผิด)",
};

async function init(): Promise<Db> {
  const db = await connect();
  await db.collection("users").limit(1).get(); // ตรวจการเชื่อมต่อ/สิทธิ์ตั้งแต่ต้น
  await seedAdmin(db);
  return db;
}

export function getDb(): Promise<Db> {
  if (!g.__fxDb) {
    g.__fxDb = init().catch((e) => {
      g.__fxDb = undefined;
      if (e instanceof AppError) throw e;
      console.error("[db] เริ่มต้น Firebase ไม่สำเร็จ", e);
      const code = typeof e?.code === "number" || typeof e?.code === "string" ? String(e.code) : "";
      const raw = e instanceof Error ? e.message : String(e);
      const safe = raw
        .replace(/"[^"]*"/g, '"…"')
        .replace(/[a-z0-9_-]+(\.[a-z0-9_-]+)+/gi, "…")
        .replace(/\s+/g, " ")
        .slice(0, 140);
      const hintText = HINTS[Number(code)] ?? (code === "app/invalid-credential" ? "private key ผิดรูปแบบ ให้คัดลอก JSON จากไฟล์ service account มาทั้งไฟล์โดยไม่แก้ไข" : "");
      const hint = hintText ? ` — ${hintText}` : "";
      throw new AppError(`เชื่อมต่อ Firebase ไม่สำเร็จ (${code || (e instanceof Error ? e.name : "Error")}: ${safe})${hint}`, 503, "DB");
    });
  }
  return g.__fxDb;
}

async function seedAdmin(db: Db) {
  const { anyAdmin, createUser } = await import("./store");
  if (await anyAdmin(db)) return;
  const dev = process.env.NODE_ENV !== "production";
  const username = (process.env.ADMIN_USERNAME || (dev ? "admin" : "")).trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || (dev ? "admin12345" : "");
  if (!username || password.length < 8) {
    console.error("ยังไม่มีแอดมิน: ตั้ง ADMIN_USERNAME และ ADMIN_PASSWORD (อย่างน้อย 8 ตัวอักษร) แล้วรีสตาร์ต");
    return;
  }
  if (dev && !process.env.ADMIN_PASSWORD) console.warn("[dev] สร้างแอดมินเริ่มต้น admin / admin12345 (ใช้เฉพาะในเครื่อง)");
  try {
    await createUser(db, { username, displayName: "ผู้ดูแลระบบ", role: "admin", passwordHash: await hashPassword(password) });
  } catch (e) {
    if (!(e instanceof AppError && e.status === 409)) throw e; // มีคนสร้างพร้อมกันแล้ว
  }
}
