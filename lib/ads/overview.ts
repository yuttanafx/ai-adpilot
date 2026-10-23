import type { Kpi } from "../data";
import { money } from "../format";
import { markReauth, listConns, getConn } from "./connections";
import { AdAuthError, CONN_LABEL, windowDates, type ConnPlatform, type DayRow, type LiveCampaign } from "./types";
import { metaReport } from "./meta";
import { tiktokReport } from "./tiktok";

export type Overview = {
  anyConnected: boolean; // ผู้ใช้มีบัญชีที่เชื่อมต่อและเลือกบัญชีแล้วอย่างน้อย 1 แพลตฟอร์ม
  connected: ConnPlatform[]; // แพลตฟอร์มที่ใช้คำนวณในผลลัพธ์นี้
  needsReconnect: ConnPlatform[];
  needsAccount: ConnPlatform[]; // เชื่อมต่อแล้วแต่ยังไม่ได้เลือกบัญชีโฆษณา
  errors: Partial<Record<ConnPlatform, string>>;
  note: string | null;
  currency: string | null;
  days: string[]; // ป้ายวัน 7 วัน
  range: { since: string; until: string } | null;
  spend: number[];
  sales: number[];
  kpis: Kpi[];
  campaigns: LiveCampaign[];
};

type Report = { daily: DayRow[]; campaigns: LiveCampaign[] };
const cache = new Map<string, { at: number; data: Report }>();
const TTL = 120_000;

const dayLabel = (ymd: string) => new Date(ymd + "T00:00:00Z").toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });

const sum = (rows: DayRow[]) =>
  rows.reduce(
    (a, r) => ({ spend: a.spend + r.spend, sales: a.sales + r.sales, purchases: a.purchases + r.purchases, clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions }),
    { spend: 0, sales: 0, purchases: 0, clicks: 0, impressions: 0 },
  );
const div = (a: number, b: number) => (b > 0 ? a / b : 0);
const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : 0);

function buildKpis(prev: DayRow[], cur: DayRow[], currency: string): Kpi[] {
  const p = sum(prev);
  const c = sum(cur);
  const m = (s: typeof c) => ({
    roas: div(s.sales, s.spend),
    cpa: div(s.spend, s.purchases),
    ctr: div(s.clicks, s.impressions) * 100,
    conv: div(s.purchases, s.clicks) * 100,
  });
  const pm = m(p);
  const cm = m(c);
  const k = (label: string, value: string, cv: number, pv: number, higherIsBetter: boolean | null): Kpi => {
    const delta = pct(cv, pv);
    return { label, value, delta, good: higherIsBetter === null ? null : higherIsBetter ? delta >= 0 : delta <= 0 };
  };
  return [
    k("1. ค่าโฆษณา", money(c.spend, currency), c.spend, p.spend, null),
    k("2. ยอดขาย", money(c.sales, currency), c.sales, p.sales, true),
    k("3. ROAS", cm.roas.toFixed(2), cm.roas, pm.roas, true),
    k("4. CPA", money(cm.cpa, currency), cm.cpa, pm.cpa, false),
    k("5. CTR (คลิกลิงก์)", cm.ctr.toFixed(1) + "%", cm.ctr, pm.ctr, true),
    k("6. อัตราปิดการขาย", cm.conv.toFixed(1) + "%", cm.conv, pm.conv, true),
  ];
}

export async function buildOverview(userId: string, requested: string): Promise<Overview> {
  const dates = windowDates();
  const days = dates.slice(7).map(dayLabel);
  const empty: Overview = {
    anyConnected: false, connected: [], needsReconnect: [], needsAccount: [], errors: {}, note: null, currency: null,
    days, range: { since: dates[7], until: dates[13] }, spend: [], sales: [], kpis: [], campaigns: [],
  };

  const conns = await listConns(userId);
  const ready = conns.filter((c) => c.status === "ok" && c.accountId);
  const out: Overview = {
    ...empty,
    anyConnected: ready.length > 0,
    needsReconnect: conns.filter((c) => c.status === "reauth").map((c) => c.platform),
    needsAccount: conns.filter((c) => c.status === "ok" && !c.accountId).map((c) => c.platform),
  };

  const wanted = ready.filter((c) => requested === "all" || c.platform === requested);
  if (!wanted.length) {
    if (requested === "google") out.note = "Google Ads ยังไม่ได้เชื่อมต่อจริง (รองรับเฉพาะ Meta และ TikTok)";
    else if (out.anyConnected && requested !== "all") out.note = `${CONN_LABEL[requested as ConnPlatform] ?? requested} ยังไม่ได้เชื่อมต่อ`;
    return out;
  }

  const currencies = new Set(wanted.map((c) => c.currency || "THB"));
  if (currencies.size > 1) {
    out.note = `บัญชีที่เชื่อมต่อใช้สกุลเงินต่างกัน (${[...currencies].join(" / ")}) จึงรวมยอดไม่ได้ กรุณาเลือกดูทีละแพลตฟอร์ม`;
    return out;
  }
  const currency = [...currencies][0];

  const results = await Promise.allSettled(
    wanted.map(async (c) => {
      const key = `${userId}:${c.platform}:${c.accountId}`;
      const hit = cache.get(key);
      if (hit && Date.now() - hit.at < TTL) return { platform: c.platform, report: hit.data };
      const full = await getConn(userId, c.platform);
      if (!full) throw new AdAuthError(c.platform);
      const report = c.platform === "meta" ? await metaReport(full.token, c.accountId, currency, dates) : await tiktokReport(full.token, c.accountId, dates);
      cache.set(key, { at: Date.now(), data: report });
      if (cache.size > 500) for (const [k, v] of cache) if (Date.now() - v.at > TTL) cache.delete(k);
      return { platform: c.platform, report };
    }),
  );

  const reports: Report[] = [];
  results.forEach((r, i) => {
    const platform = wanted[i].platform;
    if (r.status === "fulfilled") {
      reports.push(r.value.report);
      out.connected.push(platform);
    } else if (r.reason instanceof AdAuthError) {
      out.needsReconnect.push(platform);
      void markReauth(userId, platform);
    } else {
      out.errors[platform] = r.reason instanceof Error ? r.reason.message : "ดึงข้อมูลไม่สำเร็จ";
      if (!(r.reason instanceof Error) || !("status" in r.reason)) console.error(r.reason);
    }
  });
  if (!reports.length) return out;

  // รวมรายวันจากทุกแพลตฟอร์ม
  const merged: DayRow[] = dates.map((date, i) =>
    reports.reduce(
      (a, rep) => {
        const r = rep.daily[i];
        return { ...a, spend: a.spend + r.spend, sales: a.sales + r.sales, purchases: a.purchases + r.purchases, clicks: a.clicks + r.clicks, impressions: a.impressions + r.impressions };
      },
      { date, spend: 0, sales: 0, purchases: 0, clicks: 0, impressions: 0 },
    ),
  );
  const cur = merged.slice(7);
  out.currency = currency;
  out.spend = cur.map((r) => r.spend);
  out.sales = cur.map((r) => r.sales);
  out.kpis = buildKpis(merged.slice(0, 7), cur, currency);

  const camps = reports.flatMap((r) => r.campaigns).sort((a, b) => b.spend - a.spend).slice(0, 30);
  const total = camps.reduce((s, c) => s + c.spend, 0);
  out.campaigns = camps.map((c) => ({ ...c, share: total > 0 ? Math.round((c.spend / total) * 100) : 0 }));
  return out;
}
