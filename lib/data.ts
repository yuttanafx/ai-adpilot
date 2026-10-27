// ข้อมูลตัวอย่าง (mock) — เปลี่ยนเป็นดึงจาก Meta / Google / TikTok API หรือฐานข้อมูลของคุณภายหลัง

import type { MediaRef } from "./mediaTypes";

export type Platform = "all" | "meta" | "google" | "tiktok";
export type AdPlatform = Exclude<Platform, "all">;

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "all", label: "ทั้งหมด" },
  { id: "meta", label: "Meta" },
  { id: "google", label: "Google" },
  { id: "tiktok", label: "TikTok" },
];

export const DAYS = ["16 ต.ค.", "17 ต.ค.", "18 ต.ค.", "19 ต.ค.", "20 ต.ค.", "21 ต.ค.", "22 ต.ค."];
export const BASE_SPEND = [5200, 6100, 6800, 5900, 7200, 7400, 6720];
export const BASE_SALES = [21000, 25500, 28200, 24800, 31000, 30500, 28500];

// good: true = ขึ้นแล้วดี (สีเขียว), false = ขึ้นแล้วไม่ดี, null = เป็นกลาง (ไม่ตัดสินดี/ร้าย)
export type Kpi = { label: string; value: string; delta: number; good: boolean | null };

type PlatformData = { shareSpend: number; shareSales: number; kpis: Kpi[] };

const baht = (n: number) => "฿" + Math.round(n).toLocaleString("en-US");

function kpis(
  spend: number, spendD: number,
  sales: number, salesD: number,
  roas: number, roasD: number,
  cpa: number, cpaD: number,
  ctr: number, ctrD: number,
  conv: number, convD: number,
): Kpi[] {
  return [
    { label: "1. ค่าโฆษณา", value: baht(spend), delta: spendD, good: null },
    { label: "2. ยอดขาย", value: baht(sales), delta: salesD, good: true },
    { label: "3. ROAS", value: roas.toFixed(2), delta: roasD, good: true },
    { label: "4. CPA", value: baht(cpa), delta: cpaD, good: true },
    { label: "5. CTR", value: ctr.toFixed(1) + "%", delta: ctrD, good: true },
    { label: "6. อัตราปิดการขาย", value: conv.toFixed(1) + "%", delta: convD, good: true },
  ];
}

export const PLATFORM_DATA: Record<Platform, PlatformData> = {
  all: { shareSpend: 1, shareSales: 1, kpis: kpis(45320, -5, 189500, 12, 4.18, 8, 164, -3, 3.9, 1.1, 4.2, 0.5) },
  meta: { shareSpend: 0.5, shareSales: 0.525, kpis: kpis(22660, -4, 99500, 14, 4.39, 9, 152, -4, 4.3, 1.4, 4.6, 0.7) },
  google: { shareSpend: 0.3, shareSales: 0.3, kpis: kpis(13596, -6, 56850, 10, 4.18, 6, 170, -2, 3.4, 0.6, 4.1, 0.3) },
  tiktok: { shareSpend: 0.2, shareSales: 0.175, kpis: kpis(9064, -7, 33150, 9, 3.66, 5, 189, -1, 3.5, 0.9, 3.3, 0.4) },
};

export type CampaignStatus = "Active" | "Learning" | "Limited" | "Paused";
export const STATUS_TH: Record<CampaignStatus, string> = {
  Active: "กำลังทำงาน",
  Learning: "กำลังเรียนรู้",
  Limited: "ถูกจำกัด",
  Paused: "หยุดชั่วคราว",
};

export type Campaign = {
  name: string;
  platform: AdPlatform;
  status: CampaignStatus;
  budget: number;
  results: number;
  roas: number;
  quality: number;
};

export const CAMPAIGNS: Campaign[] = [
  { name: "โปรโมชันซัมเมอร์ – แคมเปญ A", platform: "meta", status: "Active", budget: 5200, results: 90, roas: 5.2, quality: 88 },
  { name: "รีมาร์เก็ตติ้ง – แคมเปญ B", platform: "meta", status: "Active", budget: 4000, results: 59, roas: 4.82, quality: 82 },
  { name: "ค้นหาแบรนด์ – ชุดโฆษณา C", platform: "google", status: "Limited", budget: 6000, results: 24, roas: 1.9, quality: 38 },
  { name: "Shopping – สินค้าขายดี", platform: "google", status: "Active", budget: 3500, results: 56, roas: 4.3, quality: 76 },
  { name: "Spark Ads – เปิดตัวสินค้า", platform: "tiktok", status: "Learning", budget: 2500, results: 38, roas: 3.1, quality: 58 },
  { name: "ทดสอบ UGC – ชุดโฆษณา D", platform: "tiktok", status: "Paused", budget: 1500, results: 10, roas: 0.9, quality: 22 },
];

export const CREATIVES = [
  { name: "ภาพหลัก – ลูกค้ายิ้ม", note: "เพิ่มงบแคมเปญ B ขึ้น 20%", winners: 3, losers: 1, initial: "ภ", from: "#7fe0a8", to: "#4c8dff" },
  { name: "ชุดเซ็ตสินค้า (Flat-lay)", note: "ROAS ต่ำกว่า 2.0", winners: 1, losers: 3, initial: "ช", from: "#ffd479", to: "#ff8a5c" },
  { name: "วิดีโอเรื่องราวผู้ก่อตั้ง", note: "ขยายไปยัง Google Shopping", winners: 3, losers: 2, initial: "ว", from: "#9ab8ff", to: "#c79bff" },
  { name: "แบนเนอร์โปรตามฤดูกาล", note: "หยุดใช้หลังรัน 6 วัน", winners: 2, losers: 2, initial: "ฤ", from: "#ff9aa0", to: "#ffd479" },
];

export type LogEntry = { id: string; ts: string; action: string; reason: string };

export type QueueStatus = "pending" | "approved" | "rejected";
export type QueueItem = {
  id: string;
  title: string;
  platform: AdPlatform | null;
  headline: string;
  primaryText: string;
  description?: string;
  cta?: string;
  brief?: string;
  media?: MediaRef[];
  status: QueueStatus;
  from: string;
  to: string;
};

export const NOTIFICATIONS = [
  { text: "งบเหลือน้อย – แคมเปญ A", time: "12 นาทีที่แล้ว" },
  { text: "CPA สูง – ชุดโฆษณา C", time: "1 ชม. ที่แล้ว" },
  { text: "โฆษณาถูกปฏิเสธ – ครีเอทีฟ #F", time: "3 ชม. ที่แล้ว" },
];
