import type { CampaignStatus } from "../data";
import { AppError } from "../db";
import { fetchRaw } from "./http";
import { AdAuthError, num, type AdAccount, type DayRow, type LiveCampaign } from "./types";

const BASE = "https://business-api.tiktok.com/open_api/v1.3";
const LABEL = "TikTok";

// ---------- OAuth ----------
export function tiktokAuthUrl(appId: string, redirectUri: string, state: string): string {
  return `https://business-api.tiktok.com/portal/auth?` + new URLSearchParams({ app_id: appId, redirect_uri: redirectUri, state });
}

type TkResponse = { code?: number; message?: string; data?: any }; // eslint-disable-line @typescript-eslint/no-explicit-any

function tkError(d: TkResponse | null, status: number): AppError {
  const code = d?.code;
  if (status === 401 || code === 40104 || code === 40105) return new AdAuthError("tiktok");
  if (code === 40100) return new AppError("TikTok จำกัดจำนวนการเรียกชั่วคราว (rate limit) กรุณารอสักครู่แล้วลองใหม่", 502, "RATE");
  if (code === 40001 || code === 40002 || code === 40003)
    return new AppError("TikTok ปฏิเสธสิทธิ์: แอปหรือบัญชีนี้ยังไม่มีสิทธิ์ดึงรายงาน ตรวจสอบสิทธิ์แล้วเชื่อมต่อใหม่", 502, "PERM");
  const detail = d?.message ? `: ${String(d.message).slice(0, 160)}` : "";
  return new AppError(`TikTok ตอบกลับผิดพลาด (รหัส ${code ?? status})${detail}`, 502);
}

async function parse(res: Response): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const d = (await res.json().catch(() => null)) as TkResponse | null;
  if (!res.ok || !d || d.code !== 0) throw tkError(d, res.status);
  return d.data ?? {};
}

export async function tiktokExchange(appId: string, secret: string, authCode: string): Promise<{ token: string; expiresAt: string | null }> {
  const data = await parse(
    await fetchRaw(LABEL, `${BASE}/oauth2/access_token/`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ app_id: appId, secret, auth_code: authCode }),
    }),
  );
  if (!data.access_token) throw new AppError("TikTok ไม่ส่ง access token กลับมา", 502);
  const secs = num(data.expires_in);
  return { token: String(data.access_token), expiresAt: secs > 0 ? new Date(Date.now() + secs * 1000).toISOString() : null };
}

async function tkGet(path: string, params: Record<string, unknown>, token: string) {
  const u = new URL(BASE + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  return parse(await fetchRaw(LABEL, u.toString(), { headers: { "Access-Token": token } }));
}

export async function tiktokAccounts(appId: string, secret: string, token: string): Promise<AdAccount[]> {
  // รายชื่อบัญชีโฆษณาที่ผู้ใช้อนุญาตให้แอปนี้
  const u = new URL(`${BASE}/oauth2/advertiser/get/`);
  u.searchParams.set("app_id", appId);
  u.searchParams.set("secret", secret);
  u.searchParams.set("access_token", token);
  const granted = await parse(await fetchRaw(LABEL, u.toString()));
  const ids: string[] = (granted.list ?? []).map((a: { advertiser_id: string }) => String(a.advertiser_id));
  if (!ids.length) return [];
  const info = await tkGet("/advertiser/info/", { advertiser_ids: ids.slice(0, 100), fields: ["advertiser_id", "name", "currency"] }, token);
  return (info.list ?? []).map((a: { advertiser_id: string; name?: string; currency?: string }) => ({
    id: String(a.advertiser_id),
    name: String(a.name || a.advertiser_id),
    currency: String(a.currency || ""),
  }));
}

// ---------- รายงาน ----------
function mapStatus(op: string | undefined, secondary: string | undefined): CampaignStatus | null {
  if (op === "DELETE" || secondary === "CAMPAIGN_STATUS_DELETE") return null;
  if (op === "DISABLE") return "Paused";
  const s = secondary ?? "";
  if (/DENY|BUDGET_EXCEED|BALANCE|LIMIT/.test(s)) return "Limited";
  if (/NOT_START|AUDIT|LEARN/.test(s)) return "Learning";
  return "Active";
}

const METRICS = ["spend", "impressions", "clicks", "complete_payment", "total_complete_payment_rate", "complete_payment_roas"];

// รายได้ = มูลค่าการซื้อ (total_complete_payment_rate) ถ้าไม่มีให้คำนวณจาก ROAS × ค่าโฆษณา
function revenue(m: Record<string, unknown>): number {
  const value = num(m.total_complete_payment_rate);
  return value > 0 ? value : num(m.spend) * num(m.complete_payment_roas);
}

export async function tiktokReport(token: string, advertiserId: string, dates: string[]): Promise<{ daily: DayRow[]; campaigns: LiveCampaign[] }> {
  const start = dates[0];
  const end = dates[dates.length - 1];
  const curStart = dates[7];
  const base = { advertiser_id: advertiserId, service_type: "AUCTION", report_type: "BASIC" };

  const [dayRep, campRep, campList] = await Promise.all([
    tkGet("/report/integrated/get/", { ...base, data_level: "AUCTION_ADVERTISER", dimensions: ["stat_time_day"], metrics: METRICS, start_date: start, end_date: end, page_size: 100 }, token),
    tkGet(
      "/report/integrated/get/",
      { ...base, data_level: "AUCTION_CAMPAIGN", dimensions: ["campaign_id"], metrics: ["campaign_name", ...METRICS], start_date: curStart, end_date: end, page_size: 200 },
      token,
    ),
    tkGet("/campaign/get/", { advertiser_id: advertiserId, fields: ["campaign_id", "campaign_name", "operation_status", "secondary_status", "budget", "budget_mode"], page_size: 1000 }, token),
  ]);

  const byDate = new Map<string, DayRow>();
  for (const r of dayRep.list ?? []) {
    const date = String(r.dimensions?.stat_time_day ?? "").slice(0, 10);
    const m = r.metrics ?? {};
    byDate.set(date, { date, spend: num(m.spend), sales: revenue(m), purchases: num(m.complete_payment), clicks: num(m.clicks), impressions: num(m.impressions) });
  }
  const daily = dates.map((d) => byDate.get(d) ?? { date: d, spend: 0, sales: 0, purchases: 0, clicks: 0, impressions: 0 });

  const meta = new Map<string, { name: string; status: CampaignStatus | null; budget: number | null }>();
  for (const c of campList.list ?? []) {
    meta.set(String(c.campaign_id), {
      name: String(c.campaign_name),
      status: mapStatus(c.operation_status, c.secondary_status),
      budget: c.budget_mode === "BUDGET_MODE_DAY" && num(c.budget) > 0 ? num(c.budget) : null,
    });
  }

  const campaigns: LiveCampaign[] = [];
  const seen = new Set<string>();
  for (const r of campRep.list ?? []) {
    const id = String(r.dimensions?.campaign_id);
    const m = meta.get(id);
    if (m && m.status === null) continue;
    seen.add(id);
    const x = r.metrics ?? {};
    const spend = num(x.spend);
    campaigns.push({
      name: String(x.campaign_name || m?.name || id),
      platform: "tiktok",
      status: m?.status ?? "Paused",
      budget: m?.budget ?? null,
      spend,
      results: num(x.complete_payment),
      roas: spend > 0 ? revenue(x) / spend : 0,
      share: 0,
    });
  }
  for (const [id, m] of meta) {
    if (!seen.has(id) && m.status === "Active") {
      campaigns.push({ name: m.name, platform: "tiktok", status: "Active", budget: m.budget, spend: 0, results: 0, roas: 0, share: 0 });
    }
  }
  return { daily, campaigns };
}
