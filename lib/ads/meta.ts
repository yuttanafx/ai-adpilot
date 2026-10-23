import type { CampaignStatus } from "../data";
import { AppError } from "../db";
import { fetchRaw } from "./http";
import { AdAuthError, num, type AdAccount, type DayRow, type LiveCampaign } from "./types";

const VERSION = process.env.META_GRAPH_VERSION?.trim() || "v23.0";
const GRAPH = `https://graph.facebook.com/${VERSION}`;
const LABEL = "Meta";

// ---------- OAuth ----------
export function metaAuthUrl(appId: string, redirectUri: string, state: string): string {
  const q = new URLSearchParams({ client_id: appId, redirect_uri: redirectUri, state, response_type: "code", scope: "ads_read" });
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${q}`;
}

type GraphErr = { message?: string; code?: number; error_subcode?: number };

function graphError(err: GraphErr | undefined, status: number): AppError {
  const code = err?.code;
  if (code === 190) return new AdAuthError("meta");
  if (code === 4 || code === 17 || code === 32 || code === 613 || (code !== undefined && code >= 80000 && code <= 80014))
    return new AppError("Meta จำกัดจำนวนการเรียกชั่วคราว (rate limit) กรุณารอสักครู่แล้วลองใหม่", 502, "RATE");
  if (code === 10 || code === 200 || code === 294)
    return new AppError("Meta ปฏิเสธสิทธิ์: แอปยังไม่มีสิทธิ์ ads_read หรือบัญชีนี้ไม่ได้ให้สิทธิ์ ตรวจสอบการอนุญาตแล้วเชื่อมต่อใหม่", 502, "PERM");
  const detail = err?.message ? `: ${err.message.slice(0, 160)}` : "";
  return new AppError(`Meta ตอบกลับผิดพลาด (รหัส ${code ?? status})${detail}`, 502);
}

async function parse(res: Response): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.error) throw graphError(data?.error, res.status);
  return data;
}

export async function metaExchange(appId: string, secret: string, redirectUri: string, code: string): Promise<{ token: string; expiresAt: string | null }> {
  const short = await parse(
    await fetchRaw(LABEL, `${GRAPH}/oauth/access_token?` + new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: redirectUri, code })),
  );
  // แลกเป็น long-lived token (ประมาณ 60 วัน)
  const long = await parse(
    await fetchRaw(
      LABEL,
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({ grant_type: "fb_exchange_token", client_id: appId, client_secret: secret, fb_exchange_token: String(short.access_token) }),
    ),
  );
  if (!long.access_token) throw new AppError("Meta ไม่ส่ง access token กลับมา", 502);
  const secs = num(long.expires_in);
  return { token: String(long.access_token), expiresAt: secs > 0 ? new Date(Date.now() + secs * 1000).toISOString() : null };
}

// ---------- Graph helpers ----------
async function graphGet(path: string, params: Record<string, string>, token: string) {
  const u = new URL(GRAPH + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set("access_token", token);
  return parse(await fetchRaw(LABEL, u.toString()));
}

// ดึงทุกหน้า (จำกัดจำนวนหน้า) และตรวจว่า paging.next ชี้ไป graph.facebook.com เท่านั้น
async function graphAll(path: string, params: Record<string, string>, token: string, maxPages = 5): Promise<any[]> { // eslint-disable-line @typescript-eslint/no-explicit-any
  let page = await graphGet(path, params, token);
  const out: any[] = [...(page.data ?? [])]; // eslint-disable-line @typescript-eslint/no-explicit-any
  for (let i = 1; i < maxPages; i++) {
    const next: string | undefined = page.paging?.next;
    if (!next) break;
    let host = "";
    try {
      host = new URL(next).hostname;
    } catch {
      break;
    }
    if (host !== "graph.facebook.com") break;
    page = await parse(await fetchRaw(LABEL, next));
    out.push(...(page.data ?? []));
  }
  return out;
}

export async function metaAccounts(token: string): Promise<AdAccount[]> {
  const rows = await graphAll("/me/adaccounts", { fields: "id,name,currency", limit: "100" }, token, 3);
  return rows.map((r) => ({ id: String(r.id), name: String(r.name || r.id), currency: String(r.currency || "") }));
}

// ---------- รายงาน ----------
type Action = { action_type?: string; value?: string };
const PURCHASE_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"];
const pickPurchase = (arr: Action[] | undefined): number => {
  for (const t of PURCHASE_TYPES) {
    const hit = arr?.find((a) => a.action_type === t);
    if (hit) return num(hit.value);
  }
  return 0;
};

// สกุลเงินที่ Meta ส่งงบเป็นหน่วยเต็ม (ไม่ใช่ หน่วยย่อย 1/100) — ถ้าใช้สกุลอื่นที่ผิดปกติให้ตรวจเพิ่ม
const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "PYG"]);
const fromMinor = (v: unknown, currency: string) => num(v) / (ZERO_DECIMAL.has(currency) ? 1 : 100);

function mapStatus(s: string | undefined): CampaignStatus | null {
  switch (s) {
    case "ACTIVE":
      return "Active";
    case "IN_PROCESS":
    case "PENDING_REVIEW":
      return "Learning";
    case "WITH_ISSUES":
    case "DISAPPROVED":
    case "PENDING_BILLING_INFO":
      return "Limited";
    case "ARCHIVED":
    case "DELETED":
      return null;
    default:
      return "Paused"; // PAUSED, CAMPAIGN_PAUSED, ADSET_PAUSED ฯลฯ
  }
}

export async function metaReport(
  token: string,
  accountId: string,
  currency: string,
  dates: string[], // 14 วัน เก่า→ใหม่
): Promise<{ daily: DayRow[]; campaigns: LiveCampaign[] }> {
  const act = accountId.startsWith("act_") ? accountId : `act_${accountId}`;
  const fields = "spend,impressions,inline_link_clicks,actions,action_values";
  const since = dates[0];
  const until = dates[dates.length - 1];
  const curSince = dates[7];

  const [dayRows, campRows, campList] = await Promise.all([
    graphAll(`/${act}/insights`, { level: "account", time_increment: "1", time_range: JSON.stringify({ since, until }), fields, limit: "100" }, token),
    graphAll(`/${act}/insights`, { level: "campaign", time_range: JSON.stringify({ since: curSince, until }), fields: `campaign_id,campaign_name,${fields}`, limit: "200" }, token),
    graphAll(`/${act}/campaigns`, { fields: "id,name,effective_status,daily_budget", limit: "200" }, token),
  ]);

  const byDate = new Map<string, DayRow>();
  for (const r of dayRows) {
    byDate.set(String(r.date_start), {
      date: String(r.date_start),
      spend: num(r.spend),
      sales: pickPurchase(r.action_values),
      purchases: pickPurchase(r.actions),
      clicks: num(r.inline_link_clicks),
      impressions: num(r.impressions),
    });
  }
  const daily = dates.map((d) => byDate.get(d) ?? { date: d, spend: 0, sales: 0, purchases: 0, clicks: 0, impressions: 0 });

  const meta = new Map<string, { name: string; status: CampaignStatus | null; budget: number | null }>();
  for (const c of campList) {
    meta.set(String(c.id), { name: String(c.name), status: mapStatus(c.effective_status), budget: c.daily_budget ? fromMinor(c.daily_budget, currency) : null });
  }

  const campaigns: LiveCampaign[] = [];
  const seen = new Set<string>();
  for (const r of campRows) {
    const id = String(r.campaign_id);
    const m = meta.get(id);
    if (m && m.status === null) continue;
    seen.add(id);
    const spend = num(r.spend);
    const sales = pickPurchase(r.action_values);
    campaigns.push({
      name: String(r.campaign_name || m?.name || id),
      platform: "meta",
      status: m?.status ?? "Paused",
      budget: m?.budget ?? null,
      spend,
      results: pickPurchase(r.actions),
      roas: spend > 0 ? sales / spend : 0,
      share: 0,
    });
  }
  // แคมเปญที่กำลังทำงานแต่ยังไม่มียอดใช้จ่ายในช่วงนี้
  for (const [id, m] of meta) {
    if (!seen.has(id) && m.status === "Active") {
      campaigns.push({ name: m.name, platform: "meta", status: "Active", budget: m.budget, spend: 0, results: 0, roas: 0, share: 0 });
    }
  }
  return { daily, campaigns };
}
