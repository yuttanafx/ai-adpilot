// ข้อมูลตัวอย่าง (mock) — เปลี่ยนเป็นดึงจาก Meta / Google / TikTok API หรือฐานข้อมูลของคุณภายหลัง

export type Platform = "all" | "meta" | "google" | "tiktok";

export const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "all", label: "All" },
  { id: "meta", label: "Meta" },
  { id: "google", label: "Google" },
  { id: "tiktok", label: "TikTok" },
];

export const DAYS = ["Oct 16", "Oct 17", "Oct 18", "Oct 19", "Oct 20", "Oct 21", "Oct 22"];
export const BASE_SPEND = [5200, 6100, 6800, 5900, 7200, 7400, 6720];
export const BASE_SALES = [21000, 25500, 28200, 24800, 31000, 30500, 28500];

export type Kpi = { label: string; value: string; delta: number; good: boolean };

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
    { label: "1. SPEND", value: baht(spend), delta: spendD, good: false },
    { label: "2. SALES", value: baht(sales), delta: salesD, good: true },
    { label: "3. ROAS", value: roas.toFixed(2), delta: roasD, good: true },
    { label: "4. CPA", value: baht(cpa), delta: cpaD, good: true },
    { label: "5. CTR", value: ctr.toFixed(1) + "%", delta: ctrD, good: true },
    { label: "6. CONV. RATE", value: conv.toFixed(1) + "%", delta: convD, good: true },
  ];
}

export const PLATFORM_DATA: Record<Platform, PlatformData> = {
  all: { shareSpend: 1, shareSales: 1, kpis: kpis(45320, -5, 189500, 12, 4.18, 8, 168, -3, 3.9, 1.1, 4.2, 0.5) },
  meta: { shareSpend: 0.5, shareSales: 0.525, kpis: kpis(22660, -4, 99500, 14, 4.39, 9, 152, -4, 4.3, 1.4, 4.6, 0.7) },
  google: { shareSpend: 0.3, shareSales: 0.3, kpis: kpis(13596, -6, 56850, 10, 4.18, 6, 171, -2, 3.4, 0.6, 4.1, 0.3) },
  tiktok: { shareSpend: 0.2, shareSales: 0.175, kpis: kpis(9064, -7, 33150, 9, 3.66, 5, 189, -1, 3.5, 0.9, 3.3, 0.4) },
};

export type CampaignStatus = "Active" | "Learning" | "Limited" | "Paused";
export type Campaign = {
  name: string;
  platform: Exclude<Platform, "all">;
  status: CampaignStatus;
  budget: number;
  results: number;
  roas: number;
  quality: number;
};

export const CAMPAIGNS: Campaign[] = [
  { name: "Summer Promo – Campaign A", platform: "meta", status: "Active", budget: 5200, results: 312, roas: 5.2, quality: 88 },
  { name: "Retargeting – Campaign B", platform: "meta", status: "Active", budget: 4000, results: 241, roas: 4.82, quality: 82 },
  { name: "Brand Search – Ad Set C", platform: "google", status: "Limited", budget: 6000, results: 96, roas: 1.9, quality: 38 },
  { name: "Shopping – Best Sellers", platform: "google", status: "Active", budget: 3500, results: 188, roas: 4.3, quality: 76 },
  { name: "Spark Ads – Launch", platform: "tiktok", status: "Learning", budget: 2500, results: 74, roas: 3.1, quality: 58 },
  { name: "UGC Test – Ad Set D", platform: "tiktok", status: "Paused", budget: 1500, results: 21, roas: 0.9, quality: 22 },
];

export const CREATIVES = [
  { name: "Hero – Smiling Customer", note: "Raised Campaign B budget by 10%", winners: 3, losers: 1, initial: "H", from: "#7fe0a8", to: "#4c8dff" },
  { name: "Product Bundle Flat-lay", note: "ROAS dropped below 2.0", winners: 1, losers: 3, initial: "P", from: "#ffd479", to: "#ff8a5c" },
  { name: "Founder Story Video", note: "Scaled to Google Shopping", winners: 3, losers: 2, initial: "F", from: "#9ab8ff", to: "#c79bff" },
  { name: "Seasonal Offer Banner", note: "Rotated out after 6 days", winners: 2, losers: 2, initial: "S", from: "#ff9aa0", to: "#ffd479" },
];

export const DECISION_LOG = [
  { date: "Oct 22, 10:18", action: "Increased Campaign B budget by 20%", reason: "ROAS 4.82" },
  { date: "Oct 21, 16:40", action: "Rotated out Creative #F", reason: "CTR below 0.8% for 3 days" },
  { date: "Oct 20, 10:05", action: "Paused Ad Set D", reason: "CPA high, over ฿250" },
  { date: "Oct 19, 09:12", action: "Shifted ฿1,000/day from Ad Set C to Campaign A", reason: "ROAS gap of 3.3 points" },
];

export const APPROVAL_QUEUE = [
  { id: "a1", title: "Summer Promo – Variant 1", initial: "A", from: "#9ab8ff", to: "#4c8dff" },
  { id: "a2", title: "Retargeting – Variant 2", initial: "B", from: "#ffd479", to: "#ff8a5c" },
  { id: "a3", title: "Brand Search – Variant 3", initial: "C", from: "#7fe0a8", to: "#3ddc84" },
];

export const NOTIFICATIONS = [
  { text: "Budget low – Campaign A", time: "12 min ago" },
  { text: "High CPA – Ad Set C", time: "1 h ago" },
  { text: "Ad rejected – Creative #F", time: "3 h ago" },
];
