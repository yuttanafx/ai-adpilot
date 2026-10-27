"use client";

import { useCallback, useEffect, useState } from "react";

type Item = {
  platform: "meta" | "tiktok";
  label: string;
  configured: boolean;
  connected: boolean;
  status: "ok" | "reauth" | null;
  accountId: string;
  accountName: string;
  currency: string;
  expiresAt: string | null;
};
type Account = { id: string; name: string; currency: string };

async function api(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("กรุณาเข้าสู่ระบบ");
  }
  if (!res.ok) throw new Error(data.error || "ดำเนินการไม่สำเร็จ");
  return data;
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("th-TH", { dateStyle: "medium", timeZone: "Asia/Bangkok" });

export default function AdConnections({ onChanged }: { onChanged: () => void }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [accounts, setAccounts] = useState<Record<string, Account[]>>({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [framed, setFramed] = useState(false);
  useEffect(() => setFramed(window.self !== window.top), []);

  const load = useCallback(async () => {
    try {
      const d = (await api("/api/ads/connections")) as { items: Item[] };
      setItems(d.items);
      // โหลดรายชื่อบัญชีโฆษณาให้แพลตฟอร์มที่เชื่อมต่อแล้วแต่ยังไม่ได้เลือก/ต้องการเปลี่ยน
      for (const it of d.items) {
        if (it.connected && it.status === "ok") {
          api(`/api/ads/accounts?platform=${it.platform}`)
            .then((r: { accounts: Account[] }) => {
              setAccounts((p) => ({ ...p, [it.platform]: r.accounts }));
              setPick((p) => ({ ...p, [it.platform]: p[it.platform] || it.accountId || r.accounts[0]?.id || "" }));
            })
            .catch((e: Error) => setErr(e.message));
        }
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "โหลดสถานะไม่สำเร็จ");
    }
  }, []);

  useEffect(() => {
    load();
    // ผลจากการกลับมาจากหน้าอนุญาตของ Meta / TikTok
    const q = new URLSearchParams(window.location.search);
    const e = q.get("ads_error");
    const ok = q.get("ads_connected");
    if (e) setErr(e);
    if (ok) {
      setMsg(`เชื่อมต่อ ${ok === "meta" ? "Meta" : "TikTok"} สำเร็จ`);
      onChanged();
    }
    if (e || ok) window.history.replaceState(null, "", window.location.pathname + "#connections");
  }, [load, onChanged]);

  const saveAccount = async (platform: string) => {
    setMsg("");
    setErr("");
    try {
      await api("/api/ads/connections", "PUT", { platform, accountId: pick[platform] });
      setMsg("บันทึกบัญชีโฆษณาแล้ว กำลังดึงข้อมูล…");
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  const disconnect = async (it: Item) => {
    if (!confirm(`ตัดการเชื่อมต่อ ${it.label} ?\nระบบจะลบ token ที่เก็บไว้ (ถ้าต้องการเพิกถอนสิทธิ์ฝั่งแพลตฟอร์มด้วย ให้ลบแอปในการตั้งค่าบัญชี ${it.platform === "meta" ? "Facebook" : "TikTok for Business"})`)) return;
    setMsg("");
    setErr("");
    try {
      await api(`/api/ads/connections?platform=${it.platform}`, "DELETE");
      setAccounts((p) => ({ ...p, [it.platform]: [] }));
      setMsg(`ตัดการเชื่อมต่อ ${it.label} แล้ว`);
      await load();
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    }
  };

  return (
    <section id="connections" aria-label="เชื่อมต่อบัญชีโฆษณา" className="panel">
      <h2>เชื่อมต่อบัญชีโฆษณา</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        เชื่อมต่อด้วยการล็อกอินกับ Meta / TikTok โดยตรง (OAuth) ระบบขอสิทธิ์อ่านรายงานเท่านั้น ไม่มีการแก้ไขหรือหยุดโฆษณาของคุณ และเก็บ token แบบเข้ารหัสแยกรายผู้ใช้
      </p>

      {framed && (
        <p className="notice" role="note" style={{ marginTop: 0 }}>
          Meta / TikTok ไม่อนุญาตให้ล็อกอินในกรอบ ปุ่มเชื่อมต่อจะเปิดแท็บใหม่ (อาจต้องเข้าสู่ระบบ AdPilot ในแท็บนั้นอีกครั้ง) เชื่อมต่อเสร็จแล้วกลับมารีเฟรชกรอบนี้
        </p>
      )}

      <ul className="key-list">
        {items === null && <li className="muted">กำลังโหลด…</li>}
        {items?.map((it) => {
          const list = accounts[it.platform] ?? [];
          return (
            <li key={it.platform} style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span className="name">{it.label}</span>
                {!it.connected && <span className="off-text">ยังไม่ได้เชื่อมต่อ</span>}
                {it.connected && it.status === "ok" && it.accountId && <span className="ok-text">เชื่อมต่อแล้ว • {it.accountName}{it.currency ? ` (${it.currency})` : ""}</span>}
                {it.connected && it.status === "ok" && !it.accountId && <span className="off-text">เชื่อมต่อแล้ว — เลือกบัญชีโฆษณาด้านล่าง</span>}
                {it.status === "reauth" && <span className="pill Limited">หมดอายุ ต้องเชื่อมต่อใหม่</span>}
                {it.connected && it.expiresAt && it.status === "ok" && <span className="muted small">token หมดอายุ {fmtDate(it.expiresAt)}</span>}
                {!it.configured ? (
                  <span className="pill Paused" title="ผู้ดูแลต้องตั้งค่า App ID / Secret ในไฟล์ .env">เซิร์ฟเวอร์ยังไม่ได้ตั้งค่าแอป</span>
                ) : (
                  <a
                    className={"btn small " + (it.connected && it.status === "ok" ? "plain" : "approve")}
                    href={`/api/ads/connect/${it.platform}`}
                    target={framed ? "_blank" : undefined}
                    rel={framed ? "noopener" : undefined}
                    style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}
                  >
                    {it.connected ? "เชื่อมต่อใหม่" : "เชื่อมต่อ"}
                  </a>
                )}
                {it.connected && (
                  <button type="button" className="btn reject small" onClick={() => disconnect(it)}>ตัดการเชื่อมต่อ</button>
                )}
              </div>

              {it.connected && it.status === "ok" && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginTop: 10 }}>
                  <label className="field" style={{ flex: "1 1 260px" }}>
                    <span>บัญชีโฆษณาที่ต้องการดูข้อมูล</span>
                    <select value={pick[it.platform] ?? ""} onChange={(e) => setPick({ ...pick, [it.platform]: e.target.value })}>
                      {list.length === 0 && <option value="">ไม่พบบัญชีโฆษณาในสิทธิ์ของคุณ</option>}
                      {list.map((a) => (
                        <option key={a.id} value={a.id}>{a.name} — {a.id}{a.currency ? ` (${a.currency})` : ""}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="btn approve small"
                    style={{ height: 44 }}
                    disabled={!pick[it.platform] || pick[it.platform] === it.accountId}
                    onClick={() => saveAccount(it.platform)}
                  >
                    ใช้บัญชีนี้
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {msg && <div className="msg-ok" style={{ marginTop: 12 }}>{msg}</div>}
      {err && <div role="alert" className="form-error" style={{ marginTop: 12 }}>{err}</div>}
    </section>
  );
}
