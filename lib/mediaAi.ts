// สร้างรูปภาพ / วิดีโอด้วย AI โดยใช้ API key ของผู้ใช้เอง
//  - รูป: Gemini (generateContent) และ OpenAI GPT Image (/v1/images/generations)
//  - วิดีโอ: Gemini Omni Flash ผ่าน Interactions API (Veo 3.1 Preview ปิดแล้ว 22 ต.ค. 2026; OpenAI ปิด Sora/Videos API แล้ว)
import { AppError } from "./db";
import { MEDIA_DEFAULT_MODELS, PROVIDERS, type Provider } from "./providers";
import type { Aspect } from "./mediaTypes";

const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
export type Generated = { bytes: Buffer; mime: string };

const imageModel = (p: Provider) =>
  p === "gemini"
    ? process.env.GEMINI_IMAGE_MODEL?.trim() || MEDIA_DEFAULT_MODELS.geminiImage
    : process.env.OPENAI_IMAGE_MODEL?.trim() || MEDIA_DEFAULT_MODELS.openaiImage;
const videoModel = () => process.env.GEMINI_VIDEO_MODEL?.trim() || MEDIA_DEFAULT_MODELS.geminiVideo;

// ข้อความผิดพลาดจากผู้ให้บริการ (ไม่มี key ปนมา) ตัดให้สั้นเพื่อแสดงผู้ใช้
async function upstreamMessage(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string } | string };
    const m = typeof j.error === "string" ? j.error : j.error?.message;
    return (m ?? "").replace(/\s+/g, " ").slice(0, 220);
  } catch {
    return "";
  }
}

async function mediaError(provider: Provider, res: Response, what: string): Promise<AppError> {
  const name = PROVIDERS[provider].label;
  const detail = await upstreamMessage(res);
  const tail = detail ? ` (${detail})` : "";
  const s = res.status;
  if (s === 401 || s === 403) return new AppError(`${name} ปฏิเสธคำขอ${what}: API key ไม่ถูกต้อง ไม่มีสิทธิ์ใช้โมเดลนี้ หรือบัญชียังไม่ได้เปิดการเรียกเก็บเงิน${tail}`, 502, "BAD_KEY");
  if (s === 404) return new AppError(`${name}: ไม่พบโมเดล${what} ชื่อโมเดลอาจเปลี่ยนแล้ว (ตั้ง GEMINI_IMAGE_MODEL / OPENAI_IMAGE_MODEL / GEMINI_VIDEO_MODEL บนเซิร์ฟเวอร์)${tail}`, 502, "BAD_MODEL");
  if (s === 429) return new AppError(`${name}: ใช้งานเกินโควตาหรือเรียกถี่เกินไป กรุณารอสักครู่หรือตรวจสอบบัญชีของคุณ${tail}`, 502, "QUOTA");
  if (s === 400) return new AppError(`${name} ปฏิเสธคำสั่ง${what} (อาจติดนโยบายเนื้อหา หรือรูปแบบไม่รองรับ) ลองปรับคำอธิบายให้เรียบง่ายขึ้น${tail}`, 502);
  return new AppError(`${name} ขัดข้องชั่วคราว (รหัส ${s}) กรุณาลองใหม่${tail}`, 502);
}

async function send(provider: Provider, url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    throw new AppError(`เชื่อมต่อ ${PROVIDERS[provider].label} ไม่ได้หรือใช้เวลานานเกินไป กรุณาลองใหม่`, 504);
  }
}

// ---------- รูปภาพ ----------
const OPENAI_SIZE: Record<Aspect, string> = { "1:1": "1024x1024", "4:5": "1024x1536", "9:16": "1024x1536", "16:9": "1536x1024" };

export async function generateImage(provider: Provider, apiKey: string, prompt: string, aspect: Aspect): Promise<Generated> {
  if (provider === "gemini") {
    const res = await send(provider, `${GEMINI}/models/${encodeURIComponent(imageModel(provider))}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
      }),
    }, 100_000);
    if (!res.ok) throw await mediaError(provider, res, "สร้างรูป");
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string }; inline_data?: { mime_type?: string; data?: string } }[] }; finishReason?: string }[];
      promptFeedback?: { blockReason?: string };
    };
    for (const part of data.candidates?.[0]?.content?.parts ?? []) {
      const d = part.inlineData?.data ?? part.inline_data?.data;
      if (d) return { bytes: Buffer.from(d, "base64"), mime: part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? "image/png" };
    }
    throw new AppError("Gemini ไม่ได้ส่งรูปกลับมา (อาจถูกกรองเนื้อหา) ลองปรับคำอธิบายภาพ", 502);
  }

  if (provider === "openai") {
    const res = await send(provider, "https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: imageModel(provider), prompt, size: OPENAI_SIZE[aspect], n: 1 }),
    }, 150_000);
    if (!res.ok) throw await mediaError(provider, res, "สร้างรูป");
    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data.data?.[0]?.b64_json;
    if (!b64) throw new AppError("OpenAI ไม่ได้ส่งรูปกลับมา ลองใหม่อีกครั้ง", 502);
    return { bytes: Buffer.from(b64, "base64"), mime: "image/png" };
  }

  throw new AppError(`${PROVIDERS[provider].label} ยังไม่มี API สร้างรูปภาพ กรุณาใช้ Gemini หรือ OpenAI`, 400);
}

// ---------- วิดีโอ (Gemini Omni Flash) ----------
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// หา object ที่เป็นวิดีโอในผลลัพธ์ (โครงสร้าง REST อยู่ใน steps[].content[] แต่รองรับ output_video ด้วย)
function findVideo(node: unknown): { uri?: string; data?: string } | null {
  if (!node || typeof node !== "object") return null;
  const o = node as Record<string, unknown>;
  if (o.type === "video" && (typeof o.uri === "string" || typeof o.data === "string")) {
    return { uri: typeof o.uri === "string" ? o.uri : undefined, data: typeof o.data === "string" ? o.data : undefined };
  }
  for (const v of Object.values(o)) {
    const f = findVideo(v);
    if (f) return f;
  }
  return null;
}

export type VideoOpts = { aspect: "9:16" | "16:9"; firstFrame?: { bytes: Buffer; mime: string } };

export async function generateVideo(apiKey: string, prompt: string, opts: VideoOpts, deadlineMs: number): Promise<Generated> {
  const provider: Provider = "gemini";
  const headers: Record<string, string> = { "content-type": "application/json", "x-goog-api-key": apiKey };
  const rev = process.env.GEMINI_API_REVISION?.trim();
  if (rev) headers["Api-Revision"] = rev;
  const left = () => Math.max(deadlineMs - Date.now(), 1000);

  const input = opts.firstFrame
    ? [
        { type: "image", data: opts.firstFrame.bytes.toString("base64"), mime_type: opts.firstFrame.mime },
        { type: "text", text: `<FIRST_FRAME> ${prompt}` },
      ]
    : prompt;

  const res = await send(provider, `${GEMINI}/interactions`, {
    method: "POST",
    headers,
    // delivery: "uri" = ให้ส่งลิงก์ไฟล์กลับมา (วิดีโอที่ใหญ่กว่า 4 MB ส่งแบบ base64 ไม่ได้)
    body: JSON.stringify({ model: videoModel(), input, response_format: { type: "video", aspect_ratio: opts.aspect, delivery: "uri" } }),
  }, left());
  if (!res.ok) throw await mediaError(provider, res, "สร้างวิดีโอ");
  const data = (await res.json()) as { status?: string };
  if (data.status && data.status !== "completed") {
    throw new AppError("Gemini สร้างวิดีโอไม่สำเร็จ (อาจถูกกรองเนื้อหาหรือโควตาเต็ม) ลองปรับคำอธิบายหรือรอสักครู่", 502);
  }
  const v = findVideo(data);
  if (!v) throw new AppError("Gemini ไม่ได้ส่งวิดีโอกลับมา (อาจถูกกรองเนื้อหา) ลองปรับคำอธิบาย", 502);
  if (v.data) return { bytes: Buffer.from(v.data, "base64"), mime: "video/mp4" };

  const fileId = /files\/([A-Za-z0-9_-]+)/.exec(v.uri ?? "")?.[1];
  if (!fileId) throw new AppError("รูปแบบลิงก์วิดีโอจาก Gemini ไม่ถูกต้อง", 502);

  // รอจนไฟล์พร้อม (ACTIVE) แล้วดาวน์โหลด
  for (;;) {
    const st = await send(provider, `${GEMINI}/files/${fileId}`, { headers: { "x-goog-api-key": apiKey } }, left());
    if (!st.ok) throw await mediaError(provider, st, "ตรวจสถานะวิดีโอ");
    const state = String(((await st.json()) as { state?: string }).state ?? "");
    if (state === "ACTIVE") break;
    if (state === "FAILED") throw new AppError("Gemini สร้างวิดีโอไม่สำเร็จ ลองใหม่อีกครั้ง", 502);
    if (Date.now() + 5000 > deadlineMs) throw new AppError("วิดีโอใช้เวลานานเกินกำหนด กรุณาลองใหม่ (หรือใช้คำอธิบายที่สั้นลง)", 504);
    await sleep(4000);
  }
  const dl = await send(provider, `${GEMINI}/files/${fileId}:download?alt=media`, { headers: { "x-goog-api-key": apiKey }, redirect: "follow" }, left());
  if (!dl.ok) throw await mediaError(provider, dl, "ดาวน์โหลดวิดีโอ");
  return { bytes: Buffer.from(await dl.arrayBuffer()), mime: "video/mp4" };
}
