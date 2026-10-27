"use client";

import { useCallback, useEffect, useState } from "react";
import TrendChart from "./TrendChart";
import CreativeGenerator, { type Creative } from "./CreativeGenerator";
import SettingsPanel from "./SettingsPanel";
import MediaPicker, { deleteMedia, useMediaCaps } from "./MediaPicker";
import { mediaUrl, type MediaRef } from "@/lib/mediaTypes";
import AdConnections from "./AdConnections";
import type { Overview } from "@/lib/ads/overview";
import { money } from "@/lib/format";
import { useStored } from "@/lib/useStored";
import { BRAND_NAME } from "@/lib/brand";
import {
  BASE_SALES,
  BASE_SPEND,
  CAMPAIGNS,
  CREATIVES,
  NOTIFICATIONS,
  PLATFORMS,
  PLATFORM_DATA,
  STATUS_TH,
  type AdPlatform,
  type LogEntry,
  type Platform,
  type QueueItem,
} from "@/lib/data";

const grad = (a: string, b: string) => ({ background: `linear-gradient(135deg, ${a}, ${b})` });
const PALETTE: [string, string][] = [["#9ab8ff", "#4c8dff"], ["#ffd479", "#ff8a5c"], ["#7fe0a8", "#3ddc84"], ["#ff9aa0", "#ffd479"], ["#c79bff", "#4c8dff"]];
const PLATFORM_LABEL: Record<AdPlatform, string> = { meta: "Meta", google: "Google", tiktok: "TikTok" };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" });

function qualityColor(q: number) {
  return q >= 70 ? "#3ddc84" : q >= 45 ? "#ffb830" : "#ff6b6b";
}

const STATE_TEXT = { pending: "รอตรวจสอบ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ" } as const;

export default function Dashboard({ user }: { user: { displayName: string; role: "admin" | "user" } }) {
  const [platform, setPlatform] = useState<Platform>("all");
  const [aiOn, setAiOn, r1] = useStored("aiOn", true);
  const [stopped, setStopped, r2] = useStored("stopped", false);
  const [queue, setQueue, r3] = useStored<QueueItem[]>("queue", []);
  const [log, setLog, r4] = useStored<LogEntry[]>("log", []);
  const loaded = r1 && r2 && r3 && r4;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ headline: string; primaryText: string; media: MediaRef[] }>({ headline: "", primaryText: "", media: [] });
  const { caps: mediaCaps, reload: reloadMediaCaps } = useMediaCaps();

  // ข้อมูลจริงจาก Meta / TikTok (ถ้าผู้ใช้เชื่อมต่อแล้ว) — ถ้ายังไม่เชื่อมต่อจะแสดงข้อมูลตัวอย่าง
  const [live, setLive] = useState<Overview | null>(null);
  const [liveErr, setLiveErr] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLiveErr("");
    fetch("/api/ads/overview?platform=" + platform)
      .then(async (r) => {
        if (r.status === 401) {
          window.location.href = "/login";
          return null;
        }
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || "ดึงข้อมูลโฆษณาไม่สำเร็จ");
        return data as Overview;
      })
      .then((data) => !cancelled && data && setLive(data))
      .catch((e: Error) => !cancelled && (setLiveErr(e.message), setLive((prev) => prev)));
    return () => {
      cancelled = true;
    };
  }, [platform, refreshKey]);

  const mode: "loading" | "mock" | "live" = live === null ? (liveErr ? "mock" : "loading") : live.anyConnected ? "live" : "mock";
  const cur = mode === "live" ? live?.currency ?? "THB" : "THB";
  const baht = (n: number) => money(n, cur);

  const mock = PLATFORM_DATA[platform];
  const d = { kpis: mode === "live" ? live!.kpis : mock.kpis };
  const spend = mode === "live" ? live!.spend : BASE_SPEND.map((v) => v * mock.shareSpend);
  const sales = mode === "live" ? live!.sales : BASE_SALES.map((v) => v * mock.shareSales);
  const days = mode === "live" ? live!.days : undefined;
  const mockCampaigns = CAMPAIGNS.filter((c) => platform === "all" || c.platform === platform);
  const hasSeries = spend.length > 0;

  const active = aiOn && !stopped;
  const statusText = stopped ? "หยุดฉุกเฉิน" : aiOn ? "ทำงาน" : "ปิด";
  const statusClass = active ? "on" : stopped ? "stopped" : "off";

  const addLog = (action: string, reason: string) =>
    setLog((prev) => [{ id: uid(), ts: new Date().toISOString(), action, reason }, ...prev].slice(0, 200));
  const patchItem = (id: string, patch: Partial<QueueItem>) =>
    setQueue((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  function toggleAi() {
    if (stopped) return; // ต้องกด "เปิดใช้งานต่อ" เท่านั้น
    const next = !aiOn;
    setAiOn(next);
    addLog(next ? "เปิดระบบ AI อัตโนมัติ" : "ปิดระบบ AI อัตโนมัติ", "ผู้ใช้สั่งเอง");
  }

  function toggleStop() {
    if (stopped) {
      setStopped(false);
      setAiOn(true);
      addLog("เปิดใช้งาน AI ต่อ", "ผู้ใช้กดเปิดใช้งานต่อ");
    } else {
      setStopped(true);
      addLog("หยุดฉุกเฉิน: ระงับการปรับงบ ปรับราคาประมูล และการเปิดโฆษณาใหม่", "ผู้ใช้กดปุ่มหยุดฉุกเฉิน");
    }
  }

  function addCreative(c: Creative, p: AdPlatform, media: MediaRef[]) {
    const [from, to] = PALETTE[queue.length % PALETTE.length];
    const item: QueueItem = {
      id: uid(),
      title: `${PLATFORM_LABEL[p]} – ${c.angle || "ชุดใหม่"}`,
      platform: p,
      headline: c.headline,
      primaryText: c.primaryText,
      description: c.description,
      cta: c.cta,
      brief: c.creativeBrief,
      media: media.length ? media : undefined,
      status: "pending",
      from,
      to,
    };
    setQueue((prev) => [item, ...prev]);
    addLog(`เพิ่มคอนเทนต์ "${item.title}" เข้าคิวอนุมัติ`, "สร้างโดย AI");
  }

  function approve(q: QueueItem) {
    patchItem(q.id, { status: "approved" });
    addLog(`อนุมัติ "${q.title}"`, "ผู้ใช้ตรวจสอบแล้ว");
  }
  function reject(q: QueueItem) {
    patchItem(q.id, { status: "rejected" });
    addLog(`ไม่อนุมัติ "${q.title}"`, "ผู้ใช้ตรวจสอบแล้ว");
  }
  function startEdit(q: QueueItem) {
    setEditingId(q.id);
    setDraft({ headline: q.headline, primaryText: q.primaryText, media: q.media ?? [] });
  }
  // ไฟล์ที่เพิ่มใหม่ระหว่างแก้ไขจะถูกลบถ้ากดยกเลิก / ไฟล์เดิมที่เอาออกจะถูกลบเมื่อกดบันทึก
  function saveEdit(q: QueueItem) {
    const keep = new Set(draft.media.map((m) => m.id));
    deleteMedia((q.media ?? []).filter((m) => !keep.has(m.id)).map((m) => m.id));
    patchItem(q.id, { headline: draft.headline, primaryText: draft.primaryText, media: draft.media.length ? draft.media : undefined, status: "pending" });
    addLog(`แก้ไขรายการ "${q.title}"`, "ผู้ใช้แก้ไขเอง");
    setEditingId(null);
  }
  function cancelEdit(q: QueueItem) {
    const old = new Set((q.media ?? []).map((m) => m.id));
    deleteMedia(draft.media.filter((m) => !old.has(m.id)).map((m) => m.id));
    setEditingId(null);
  }
  function removeItem(q: QueueItem) {
    deleteMedia((q.media ?? []).map((m) => m.id));
    setQueue((prev) => prev.filter((x) => x.id !== q.id));
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const recentLog = [...log].sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 20);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <svg width="30" height="30" viewBox="0 0 30 30" fill="none" aria-hidden="true">
            <path d="M3 27L14 3l5 11" stroke="#4c8dff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M11 27l8-14 8 14" stroke="#7fe0a8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {BRAND_NAME}
        </div>
        <nav className="nav" aria-label="เมนูหลัก">
          <a href="#dashboard" aria-current="page">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>
            แดชบอร์ด
          </a>
          <a href="#generate">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" /><path d="M18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15z" /></svg>
            สร้างคอนเทนต์ AI
          </a>
          <a href="#creatives">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" /></svg>
            ครีเอทีฟ
          </a>
          <a href="#queue">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l4 4 10-10" /></svg>
            คิวอนุมัติ
          </a>
          <a href="#log">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
            บันทึกการตัดสินใจ
          </a>
          <a href="#connections">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1" /></svg>
            เชื่อมต่อบัญชีโฆษณา
          </a>
          <a href="#settings">
            <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></svg>
            ตั้งค่า AI ของฉัน
          </a>
          {user.role === "admin" && (
            <a href="/admin">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.5a3.5 3.5 0 010 7M18.5 14.8c1.7.7 2.8 2.3 3 5.2" /></svg>
              จัดการผู้ใช้
            </a>
          )}
        </nav>
      </aside>

      <main id="dashboard" className="main">
        <header className="topbar">
          <div className="chips" role="group" aria-label="แพลตฟอร์ม">
            {PLATFORMS.map((p) => (
              <button key={p.id} type="button" className="chip" aria-pressed={platform === p.id} onClick={() => setPlatform(p.id)}>
                {p.label}
              </button>
            ))}
          </div>
          <span className="muted">{mode === "live" && live?.days.length ? `7 วันล่าสุด (${live.days[0]} – ${live.days[live.days.length - 1]})` : "7 วันล่าสุด (16–22 ต.ค.)"}</span>
          <div className="spacer" />
          <div className="status">
            <span>สถานะ AI: <b className={statusClass}>{statusText}</b></span>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="ระบบ AI อัตโนมัติ"
              className="switch"
              disabled={stopped}
              onClick={toggleAi}
              style={stopped ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              <span />
            </button>
          </div>
          <button type="button" className={stopped ? "stop resume" : "stop"} onClick={toggleStop}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
            {stopped ? "เปิดใช้งานต่อ" : "หยุดฉุกเฉิน"}
          </button>
          <span className="userchip"><b>{user.displayName}</b>{user.role === "admin" && <span className="pill role-admin">แอดมิน</span>}</span>
          <button type="button" className="logout" onClick={logout}>ออกจากระบบ</button>
        </header>

        {mode === "live" ? (
          <div className="notice" role="note">
            ตัวเลขนี้เป็นข้อมูลจริงจาก {live!.connected.length ? live!.connected.map((p) => (p === "meta" ? "Meta" : "TikTok")).join(" + ") : "บัญชีที่เชื่อมต่อ"} (อ่านอย่างเดียว เทียบกับ 7 วันก่อนหน้า)
            Google Ads ยังไม่รองรับ ส่วนสวิตช์ AI และปุ่มหยุดฉุกเฉินยังไม่ได้ควบคุมโฆษณาจริง
          </div>
        ) : (
          <div className="notice" role="note">
            ตัวเลขในแดชบอร์ดนี้เป็นข้อมูลตัวอย่าง เชื่อมต่อบัญชี Meta / TikTok ได้ที่ส่วน “เชื่อมต่อบัญชีโฆษณา” ด้านล่างเพื่อดูข้อมูลจริง
            ส่วนการสร้างคอนเทนต์ด้วย AI (ใช้ API key ของคุณเอง) และคิวอนุมัติใช้งานได้จริง
          </div>
        )}

        {liveErr && <div role="alert" className="form-error">{liveErr}</div>}
        {live?.needsReconnect.map((p) => (
          <div key={"re" + p} role="alert" className="banner">
            การเชื่อมต่อ {p === "meta" ? "Meta" : "TikTok"} หมดอายุหรือถูกเพิกถอน ไปที่ “เชื่อมต่อบัญชีโฆษณา” แล้วกดเชื่อมต่อใหม่
          </div>
        ))}
        {live && Object.entries(live.errors).map(([p, m]) => (
          <div key={"er" + p} role="alert" className="form-error">{p === "meta" ? "Meta" : "TikTok"}: {m}</div>
        ))}
        {live?.needsAccount.length ? (
          <div className="notice" role="note">เชื่อมต่อแล้วแต่ยังไม่ได้เลือกบัญชีโฆษณา กรุณาเลือกที่ส่วน “เชื่อมต่อบัญชีโฆษณา”</div>
        ) : null}
        {mode === "live" && live?.note && <div className="notice" role="note">{live.note}</div>}

        {loaded && stopped && (
          <div role="status" className="banner">
            หยุดฉุกเฉินอยู่ ระบบ AI ระงับการปรับงบ ปรับราคาประมูล และเปิดโฆษณาใหม่ทั้งหมด และจะอนุมัติโฆษณาไม่ได้ กด “เปิดใช้งานต่อ” เพื่อคืนการควบคุมให้ AI
          </div>
        )}

        {mode === "loading" && <p className="muted">กำลังโหลดข้อมูล…</p>}

        <section aria-label="ตัวชี้วัดหลัก" className="kpis">
          {mode !== "loading" && d.kpis.map((k) => (
            <div key={k.label} className="kpi">
              <div className="kpi-head">
                <span className="kpi-label">{k.label}</span>
                <span className={"delta " + (k.good === null ? "neutral" : k.good ? "good" : "bad")}>
                  {k.delta >= 0 ? "▲ +" : "▼ "}{k.delta}%
                </span>
              </div>
              <div className="kpi-value">{k.value}</div>
            </div>
          ))}
        </section>

        <section aria-label="กราฟแนวโน้ม" className="panel">
          <div className="chart-head">
            <h2>กราฟแนวโน้ม</h2>
            <span className="legend"><i style={{ background: "#4c8dff" }} />ค่าโฆษณา (฿)</span>
            <span className="legend"><i style={{ background: "#3ddc84" }} />ยอดขาย (฿)</span>
          </div>
          {mode !== "loading" && hasSeries ? <TrendChart spend={spend} sales={sales} days={days} currency={cur} /> : <p className="muted">{mode === "loading" ? "กำลังโหลด…" : "ไม่มีข้อมูลสำหรับแพลตฟอร์มนี้"}</p>}
        </section>

        <section aria-label="ตารางผลงานแคมเปญ" className="panel">
          <h2>ตารางผลงานแคมเปญ</h2>
          <div className="scroll">
            {mode === "live" ? (
              <table style={{ minWidth: 760 }}>
                <thead>
                  <tr><th>ชื่อ</th><th>แพลตฟอร์ม</th><th>สถานะ</th><th>งบ / วัน</th><th>ค่าโฆษณา 7 วัน</th><th>ผลลัพธ์</th><th>ROAS</th><th>สัดส่วนค่าโฆษณา</th></tr>
                </thead>
                <tbody>
                  {live!.campaigns.length === 0 && <tr><td colSpan={8} className="muted">ไม่พบแคมเปญที่มีข้อมูลในช่วงนี้</td></tr>}
                  {live!.campaigns.map((c) => (
                    <tr key={c.platform + c.name}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td>{PLATFORM_LABEL[c.platform]}</td>
                      <td><span className={"pill " + c.status}>{STATUS_TH[c.status]}</span></td>
                      <td>{c.budget === null ? "—" : baht(c.budget)}</td>
                      <td>{baht(c.spend)}</td>
                      <td>{c.results} ออเดอร์</td>
                      <td style={{ fontWeight: 600 }}>{c.roas.toFixed(2)}</td>
                      <td>
                        <div className="bar" role="img" aria-label={`สัดส่วนค่าโฆษณา ${c.share}%`}>
                          <div style={{ width: c.share + "%", background: "#4c8dff" }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table style={{ minWidth: 640 }}>
                <thead>
                  <tr><th>ชื่อ</th><th>สถานะ</th><th>งบ / วัน</th><th>ผลลัพธ์</th><th>ROAS</th><th>คุณภาพ</th></tr>
                </thead>
                <tbody>
                  {mockCampaigns.map((c) => (
                    <tr key={c.name}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td><span className={"pill " + c.status}>{STATUS_TH[c.status]}</span></td>
                      <td>{baht(c.budget)}</td>
                      <td>{c.results} ออเดอร์</td>
                      <td style={{ fontWeight: 600, color: qualityColor(c.quality) }}>{c.roas.toFixed(2)}</td>
                      <td>
                        <div className="bar" role="img" aria-label={`คุณภาพ ${c.quality} จาก 100`}>
                          <div style={{ width: c.quality + "%", background: qualityColor(c.quality) }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <CreativeGenerator onAdd={addCreative} />

        <section id="creatives" aria-label="ครีเอทีฟที่ชนะและแพ้" className="panel">
          <h2>ครีเอทีฟที่ชนะและแพ้</h2>
          <div className="cards">
            {CREATIVES.map((c) => (
              <div key={c.name} className="card">
                <div className="thumb" style={grad(c.from, c.to)} aria-hidden="true">{c.initial}</div>
                <div className="card-body">
                  <span className="card-title">{c.name}</span>
                  <span className="card-note">{c.note}</span>
                  <div className="wl"><span className="w">ชนะ {c.winners}</span><span className="l">แพ้ {c.losers}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="log" aria-label="บันทึกการตัดสินใจของ AI" className="panel">
          <h2>บันทึกการตัดสินใจของ AI</h2>
          <div className="scroll">
            <table style={{ minWidth: 560 }}>
              <thead><tr><th>วันที่</th><th>การกระทำ</th><th>เหตุผล</th></tr></thead>
              <tbody>
                {recentLog.length === 0 && (
                  <tr><td colSpan={3} className="muted">ยังไม่มีบันทึก การอนุมัติและการกดปุ่มต่างๆ จะถูกบันทึกที่นี่</td></tr>
                )}
                {recentLog.map((l) => (
                  <tr key={l.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtTime(l.ts)}</td>
                    <td>{l.action}</td>
                    <td style={{ color: "#c4cada" }}>{l.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="split">
          <section id="queue" aria-label="คิวอนุมัติโฆษณา" className="panel queue">
            <h2>คิวอนุมัติโฆษณา</h2>
            {queue.length === 0 && <p className="muted">ยังไม่มีรายการ ลองสร้างคอนเทนต์ด้วย AI ด้านบน</p>}
            <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
              {queue.map((q) => {
                const editing = editingId === q.id;
                return (
                  <div key={q.id} className="card col">
                    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                      <div className="thumb" style={grad(q.from, q.to)} aria-hidden="true">{q.title.charAt(0)}</div>
                      <div className="card-body">
                        <span className="card-title">{q.title}</span>
                        <span className={"state " + q.status}>{STATE_TEXT[q.status]}</span>
                      </div>
                    </div>
                    {editing ? (
                      <>
                        <label className="field">
                          <span>หัวข้อ</span>
                          <input value={draft.headline} onChange={(e) => setDraft({ ...draft, headline: e.target.value })} />
                        </label>
                        <label className="field">
                          <span>ข้อความหลัก</span>
                          <textarea value={draft.primaryText} onChange={(e) => setDraft({ ...draft, primaryText: e.target.value })} />
                        </label>
                        <MediaPicker
                          value={draft.media}
                          onChange={(v) => setDraft((d) => ({ ...d, media: v }))}
                          caps={mediaCaps}
                          reloadCaps={reloadMediaCaps}
                          platform={q.platform ?? "meta"}
                          deferDelete
                          defaultPrompt={q.brief || q.headline}
                        />
                        <div className="row">
                          <button type="button" className="btn approve" onClick={() => saveEdit(q)}>บันทึก</button>
                          <button type="button" className="btn edit" onClick={() => cancelEdit(q)}>ยกเลิก</button>
                        </div>
                      </>
                    ) : (
                      <>
                        {q.media && q.media.length > 0 && (
                          <div className="media-grid">
                            {q.media.map((m) => (
                              <div key={m.id} className="media-item">
                                {m.kind === "image" ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={mediaUrl(m.id)} alt={m.name || "รูปโฆษณา"} loading="lazy" />
                                ) : (
                                  <video src={mediaUrl(m.id)} controls preload="metadata" playsInline />
                                )}
                                <span className="media-badge">{m.source === "ai" ? "AI" : m.kind === "image" ? "รูป" : "วิดีโอ"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600 }}>{q.headline}</div>
                          <div className="card-note">{q.primaryText}</div>
                        </div>
                        <div className="row">
                          {q.status === "pending" ? (
                            <>
                              <button type="button" className="btn approve" disabled={stopped || !loaded} title={stopped ? "ปิดอยู่ระหว่างหยุดฉุกเฉิน" : undefined} onClick={() => approve(q)}>อนุมัติ</button>
                              <button type="button" className="btn edit" onClick={() => startEdit(q)}>แก้ไข</button>
                              <button type="button" className="btn reject" onClick={() => reject(q)}>ไม่อนุมัติ</button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="btn edit" onClick={() => patchItem(q.id, { status: "pending" })}>ย้อนกลับเป็นรอตรวจสอบ</button>
                              <button type="button" className="btn reject" onClick={() => removeItem(q)}>ลบ</button>
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section aria-label="การแจ้งเตือน" className="panel notes">
            <h2>การแจ้งเตือน</h2>
            <ul className="list">
              {NOTIFICATIONS.map((n) => (
                <li key={n.text}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true"><path d="M12 3L2 21h20L12 3z" /><path d="M12 10v5M12 18v.01" /></svg>
                  <span className="t">{n.text}</span>
                  <span className="time">{n.time}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <AdConnections onChanged={refresh} />

        <SettingsPanel />
      </main>
    </div>
  );
}
