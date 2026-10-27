// ชนิดข้อมูลสื่อ (รูป/วิดีโอ) ที่ใช้ร่วมกันทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์ — ห้าม import โค้ดฝั่งเซิร์ฟเวอร์ที่นี่
import type { Provider } from "./providers";

export type MediaKind = "image" | "video";
export type MediaSource = "ai" | "upload";

// สิ่งที่เก็บไว้ในคิวอนุมัติ (เก็บแค่ตัวอ้างอิง ไม่เก็บไฟล์ เพราะ Firestore จำกัด 1 MiB ต่อเอกสาร)
export type MediaRef = { id: string; kind: MediaKind; mime: string; name: string; source: MediaSource };

export const mediaUrl = (id: string) => `/api/media/${encodeURIComponent(id)}`;

export const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const VIDEO_MIMES = ["video/mp4", "video/quicktime", "video/webm"];
export const MAX_MEDIA_PER_ITEM = 4;

export type Aspect = "1:1" | "4:5" | "9:16" | "16:9";
export const ASPECT_LABEL: Record<Aspect, string> = {
  "1:1": "จัตุรัส 1:1 (ฟีด)",
  "4:5": "แนวตั้ง 4:5 (ฟีด)",
  "9:16": "แนวตั้ง 9:16 (สตอรี่/รีลส์/TikTok)",
  "16:9": "แนวนอน 16:9",
};
export const IMAGE_ASPECTS: Aspect[] = ["1:1", "4:5", "9:16", "16:9"];
export const VIDEO_ASPECTS: Aspect[] = ["9:16", "16:9"]; // Gemini Omni รองรับเฉพาะ 2 อัตราส่วนนี้

export type MediaCaps = {
  storage: "cloud" | "local" | null; // null = ยังไม่ได้ตั้งที่เก็บไฟล์บน production
  image: Provider[]; // ผู้ให้บริการที่ผู้ใช้ใส่ API key ไว้แล้วและสร้างรูปได้
  video: Provider[];
  imageSupported: Provider[]; // ผู้ให้บริการที่ระบบรองรับ (ไว้บอกผู้ใช้ว่าต้องใส่ key ตัวไหน)
  videoSupported: Provider[];
  maxImageMB: number;
  maxVideoMB: number;
};
