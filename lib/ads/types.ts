import { AppError } from "../db";
import type { AdPlatform, CampaignStatus } from "../data";

// แพลตฟอร์มที่เชื่อมต่อจริงได้ (Google ยังไม่รองรับ)
export type ConnPlatform = Exclude<AdPlatform, "google">;
export const CONN_PLATFORMS: ConnPlatform[] = ["meta", "tiktok"];
export const CONN_LABEL: Record<ConnPlatform, string> = { meta: "Meta (Facebook / Instagram)", tiktok: "TikTok" };
export const isConnPlatform = (v: unknown): v is ConnPlatform => v === "meta" || v === "tiktok";

export type DayRow = { date: string; spend: number; sales: number; purchases: number; clicks: number; impressions: number };

export type LiveCampaign = {
  name: string;
  platform: ConnPlatform;
  status: CampaignStatus;
  budget: number | null; // งบรายวัน (null = ไม่ได้ตั้งงบรายวันระดับแคมเปญ)
  spend: number;
  results: number; // จำนวนออเดอร์ (purchase)
  roas: number;
  share: number; // สัดส่วนค่าโฆษณาของแคมเปญนี้ (%)
};

export type AdAccount = { id: string; name: string; currency: string };

// token ใช้ไม่ได้แล้ว (หมดอายุ/ถูกเพิกถอน) ต้องให้ผู้ใช้เชื่อมต่อใหม่
export class AdAuthError extends AppError {
  constructor(platform: ConnPlatform) {
    super(`การเชื่อมต่อ ${CONN_LABEL[platform]} หมดอายุหรือถูกเพิกถอน กรุณาเชื่อมต่อใหม่`, 409, "REAUTH");
  }
}

// ---- วันที่ (ใช้เขตเวลา Asia/Bangkok) ----
export function bangkokToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}
export function addDays(ymd: string, n: number): string {
  const d = new Date(ymd + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 14 วันล่าสุดที่จบแล้ว (เมื่อวานย้อนหลัง) เรียงเก่า→ใหม่: 7 วันแรก = ช่วงก่อนหน้า, 7 วันหลัง = ช่วงปัจจุบัน */
export function windowDates(): string[] {
  const yesterday = addDays(bangkokToday(), -1);
  return Array.from({ length: 14 }, (_, i) => addDays(yesterday, i - 13));
}

export const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};
