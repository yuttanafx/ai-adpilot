// ที่เก็บรูป/วิดีโอรายผู้ใช้
//  - production: Firebase Storage (ตั้ง FIREBASE_STORAGE_BUCKET) อัปโหลดตรงจากเบราว์เซอร์ด้วย signed URL (เลี่ยงขีดจำกัด 4.5 MB ของ Vercel)
//  - ตอนพัฒนาในเครื่อง: เก็บเป็นไฟล์ใน .data/media (ไม่ต้องมี Firebase)
// ข้อมูลกำกับไฟล์ (เจ้าของ ชนิด ขนาด) อยู่ใน Firestore: users/{uid}/media/{id} ไฟล์เข้าถึงได้เฉพาะเจ้าของผ่าน /api/media/{id}
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { AppError, getDb, newId } from "./db";
import { IMAGE_MIMES, VIDEO_MIMES, type MediaKind, type MediaRef, type MediaSource } from "./mediaTypes";

const MB = 1024 * 1024;
export const MAX_IMAGE_BYTES = 10 * MB;
export const MAX_VIDEO_BYTES = Math.min(Math.max(Number(process.env.MEDIA_MAX_VIDEO_MB) || 200, 5), 1024) * MB;

const EXT: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
};

type Bucket = ReturnType<ReturnType<typeof import("firebase-admin/storage").getStorage>["bucket"]>;
export type MediaMeta = { id: string; kind: MediaKind; mime: string; size: number; name: string; source: MediaSource; ready: boolean };

const LOCAL_DIR = path.resolve("./.data/media");
const objectName = (uid: string, id: string) => `media/${uid}/${id}`;
const localPath = (uid: string, id: string) => path.join(LOCAL_DIR, uid, id);
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

// เลือกที่เก็บ: cloud (ถ้าตั้ง bucket และมี Firebase จริง) / local (เฉพาะตอนพัฒนา) / null (production แต่ยังไม่ตั้ง bucket)
async function backend(): Promise<{ type: "cloud"; bucket: Bucket } | { type: "local" } | null> {
  await getDb(); // ให้แน่ใจว่าเริ่ม Firebase แล้ว
  const name = process.env.FIREBASE_STORAGE_BUCKET?.trim().replace(/^gs:\/\//, "");
  const { getApps } = await import("firebase-admin/app");
  if (name && getApps().length > 0) {
    const { getStorage } = await import("firebase-admin/storage");
    return { type: "cloud", bucket: getStorage(getApps()[0]).bucket(name) };
  }
  return process.env.NODE_ENV === "production" ? null : { type: "local" };
}

export async function storageType(): Promise<"cloud" | "local" | null> {
  return (await backend())?.type ?? null;
}

async function need() {
  const b = await backend();
  if (!b) {
    throw new AppError("ยังไม่ได้ตั้งที่เก็บไฟล์ (FIREBASE_STORAGE_BUCKET) บนเซิร์ฟเวอร์ ดูวิธีตั้งใน README หัวข้อ “รูปและวิดีโอ”", 503, "NO_STORAGE");
  }
  return b;
}

const col = async (uid: string) => (await getDb()).collection("users").doc(uid).collection("media");

function validate(kind: unknown, mime: unknown, size: number): { kind: MediaKind; mime: string } {
  if (kind !== "image" && kind !== "video") throw new AppError("ชนิดไฟล์ไม่ถูกต้อง", 400);
  const m = typeof mime === "string" ? mime.toLowerCase() : "";
  if (!(kind === "image" ? IMAGE_MIMES : VIDEO_MIMES).includes(m)) {
    throw new AppError(kind === "image" ? "รองรับรูป JPG / PNG / WebP / GIF เท่านั้น" : "รองรับวิดีโอ MP4 / MOV / WebM เท่านั้น", 400);
  }
  const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (!Number.isFinite(size) || size <= 0) throw new AppError("ไฟล์ว่างเปล่า", 400);
  if (size > max) throw new AppError(`ไฟล์ใหญ่เกินกำหนด (สูงสุด ${Math.round(max / MB)} MB)`, 413);
  return { kind, mime: m };
}

const cleanName = (n: unknown, fallback: string) =>
  (typeof n === "string" ? n : "").replace(/[\u0000-\u001f<>"'`\\/]/g, "").trim().slice(0, 100) || fallback;

export const toRef = (m: MediaMeta): MediaRef => ({ id: m.id, kind: m.kind, mime: m.mime, name: m.name, source: m.source });

// ---------- อัปโหลดจากเบราว์เซอร์ ----------
export async function createUpload(uid: string, input: { kind: unknown; mime: unknown; size: number; name: unknown }) {
  const { kind, mime } = validate(input.kind, input.mime, input.size);
  const b = await need();
  const id = newId();
  const name = cleanName(input.name, `${kind}.${EXT[mime]}`);
  await (await col(uid)).doc(id).set({ kind, mime, size: input.size, name, source: "upload", ready: false, created_at: new Date().toISOString() });

  if (b.type === "cloud") {
    const [uploadUrl] = await b.bucket.file(objectName(uid, id)).getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60_000,
      contentType: mime,
    });
    return { id, uploadUrl, headers: { "Content-Type": mime } };
  }
  return { id, uploadUrl: `/api/media/${id}`, headers: { "Content-Type": mime } };
}

// เครื่องตัวเอง (dev): รับไฟล์ผ่านเซิร์ฟเวอร์
export async function saveLocalUpload(uid: string, id: string, body: ArrayBuffer) {
  const meta = await getMeta(uid, id);
  if (!meta || meta.ready) throw new AppError("ไม่พบรายการอัปโหลด", 404);
  if (body.byteLength !== meta.size) throw new AppError("ขนาดไฟล์ไม่ตรงกับที่แจ้งไว้", 400);
  mkdirSync(path.join(LOCAL_DIR, uid), { recursive: true });
  await writeFile(localPath(uid, id), Buffer.from(body));
}

// ยืนยันว่าอัปโหลดเสร็จจริง (ตรวจขนาด/ชนิดฝั่งเซิร์ฟเวอร์อีกครั้ง ไม่เชื่อค่าจากเบราว์เซอร์)
export async function completeUpload(uid: string, id: string): Promise<MediaRef> {
  const meta = await getMeta(uid, id);
  if (!meta) throw new AppError("ไม่พบไฟล์", 404);
  if (meta.ready) return toRef(meta);
  const b = await need();
  let size = 0;
  let mime = meta.mime;
  if (b.type === "cloud") {
    const f = b.bucket.file(objectName(uid, id));
    const [exists] = await f.exists();
    if (!exists) throw new AppError("ยังไม่พบไฟล์ที่อัปโหลด กรุณาลองใหม่", 409);
    const [md] = await f.getMetadata();
    size = Number(md.size);
    mime = String(md.contentType ?? "").toLowerCase();
  } else {
    const p = localPath(uid, id);
    if (!existsSync(p)) throw new AppError("ยังไม่พบไฟล์ที่อัปโหลด กรุณาลองใหม่", 409);
    size = statSync(p).size;
  }
  const max = meta.kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (size <= 0 || size > max || mime !== meta.mime) {
    await removeObject(uid, id);
    await (await col(uid)).doc(id).delete();
    throw new AppError("ไฟล์ไม่ตรงตามที่กำหนด (ขนาดหรือชนิดไฟล์) จึงไม่ได้แนบ", 400);
  }
  await (await col(uid)).doc(id).update({ ready: true, size });
  return toRef({ ...meta, size, ready: true });
}

// ---------- ไฟล์ที่ AI สร้าง ----------
export async function saveGenerated(uid: string, kind: MediaKind, mime: string, bytes: Buffer, name: string): Promise<MediaRef> {
  const { mime: m } = validate(kind, mime, bytes.length);
  const b = await need();
  const id = newId();
  if (b.type === "cloud") {
    await b.bucket.file(objectName(uid, id)).save(bytes, { contentType: m, resumable: false });
  } else {
    mkdirSync(path.join(LOCAL_DIR, uid), { recursive: true });
    await writeFile(localPath(uid, id), bytes);
  }
  const meta: MediaMeta = { id, kind, mime: m, size: bytes.length, name, source: "ai", ready: true };
  await (await col(uid)).doc(id).set({ kind, mime: m, size: bytes.length, name, source: "ai", ready: true, created_at: new Date().toISOString() });
  return toRef(meta);
}

// ---------- อ่าน/ลบ ----------
export async function getMeta(uid: string, id: string): Promise<MediaMeta | null> {
  if (!isUuid(id)) return null;
  const s = await (await col(uid)).doc(id).get();
  if (!s.exists) return null;
  const d = s.data()!;
  return { id, kind: d.kind, mime: d.mime, size: Number(d.size) || 0, name: String(d.name ?? ""), source: d.source === "ai" ? "ai" : "upload", ready: d.ready === true };
}

export async function readBytes(uid: string, id: string): Promise<{ meta: MediaMeta; bytes: Buffer }> {
  const meta = await getMeta(uid, id);
  if (!meta || !meta.ready) throw new AppError("ไม่พบไฟล์", 404);
  const b = await need();
  if (b.type === "cloud") {
    const [bytes] = await b.bucket.file(objectName(uid, id)).download();
    return { meta, bytes };
  }
  return { meta, bytes: await readFile(localPath(uid, id)) };
}

// cloud: ลิงก์อ่านชั่วคราว (ส่งผู้ใช้ไปโหลดจาก Storage ตรงๆ รองรับการกรอวิดีโอ) / local: สตรีมจากดิสก์พร้อม Range
export async function openForRead(uid: string, id: string, range: string | null): Promise<Response> {
  const meta = await getMeta(uid, id);
  if (!meta || !meta.ready) throw new AppError("ไม่พบไฟล์", 404);
  const b = await need();
  if (b.type === "cloud") {
    const [url] = await b.bucket.file(objectName(uid, id)).getSignedUrl({ version: "v4", action: "read", expires: Date.now() + 10 * 60_000 });
    return new Response(null, { status: 302, headers: { location: url, "cache-control": "private, max-age=300" } });
  }
  const p = localPath(uid, id);
  if (!existsSync(p)) throw new AppError("ไม่พบไฟล์", 404);
  const size = statSync(p).size;
  const base = { "content-type": meta.mime, "accept-ranges": "bytes", "cache-control": "private, max-age=300", "x-content-type-options": "nosniff" };
  const m = range ? /^bytes=(\d*)-(\d*)$/.exec(range) : null;
  if (m && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : size - Number(m[2]);
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    start = Math.max(0, start);
    end = Math.min(end, size - 1);
    if (start > end) return new Response(null, { status: 416, headers: { ...base, "content-range": `bytes */${size}` } });
    const stream = Readable.toWeb(createReadStream(p, { start, end })) as unknown as ReadableStream;
    return new Response(stream, { status: 206, headers: { ...base, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
  }
  return new Response(Readable.toWeb(createReadStream(p)) as unknown as ReadableStream, { status: 200, headers: { ...base, "content-length": String(size) } });
}

async function removeObject(uid: string, id: string) {
  const b = await backend();
  if (!b) return;
  if (b.type === "cloud") await b.bucket.file(objectName(uid, id)).delete({ ignoreNotFound: true }).catch(() => {});
  else await rm(localPath(uid, id), { force: true }).catch(() => {});
}

export async function deleteMedia(uid: string, id: string) {
  if (!isUuid(id)) return;
  const ref = (await col(uid)).doc(id);
  if (!(await ref.get()).exists) return;
  await removeObject(uid, id);
  await ref.delete();
}

// ลบไฟล์ทั้งหมดของผู้ใช้ (เรียกตอนแอดมินลบบัญชี เพราะการลบเอกสารผู้ใช้ไม่ได้ลบไฟล์ใน Storage)
export async function deleteAllMedia(uid: string) {
  const snap = await (await col(uid)).get();
  for (const d of snap.docs) await removeObject(uid, d.id);
}
