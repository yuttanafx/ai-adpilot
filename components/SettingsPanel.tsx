"use client";

import { useCallback, useEffect, useState } from "react";
import { PROVIDERS, PROVIDER_IDS, type Provider } from "@/lib/providers";

type Me = {
  provider: Provider;
  model: string;
  keys: Record<Provider, { set: boolean; last4: string }>;
};

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("กรุณาเข้าสู่ระบบ");
  }
  if (!res.ok) throw new Error(data.error || "บันทึกไม่สำเร็จ");
  return data;
}

export default function SettingsPanel() {
  const [me, setMe] = useState<Me | null>(null);
  const [provider, setProvider] = useState<Provider>("gemini");
  const [model, setModel] = useState("");
  const [keyDraft, setKeyDraft] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [pw, setPw] = useState({ current: "", next: "" });
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/me");
    if (!r.ok) return;
    const d = (await r.json()) as Me;
    setMe(d);
    setProvider(d.provider);
    setModel(d.model);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<void>, ok: string) => {
    setMsg("");
    setErr("");
    try {
      await fn();
      setMsg(ok);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  };

  const saveKey = () =>
    run(async () => {
      await api("/api/settings/key", "PUT", { provider, key: keyDraft });
      await api("/api/settings", "PUT", { provider, model });
      setKeyDraft("");
    }, "บันทึก API key และตั้งเป็นผู้ให้บริการที่ใช้อยู่แล้ว");

  const saveProvider = () => run(() => api("/api/settings", "PUT", { provider, model }), "บันทึกการตั้งค่าแล้ว");

  const removeKey = (p: Provider) => {
    if (!confirm(`ลบ API key ของ ${PROVIDERS[p].label} ?`)) return;
    run(() => api(`/api/settings/key?provider=${p}`, "DELETE"), "ลบ API key แล้ว");
  };

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    setPwErr("");
    try {
      await api("/api/settings/password", "POST", pw);
      setPw({ current: "", next: "" });
      setPwMsg("เปลี่ยนรหัสผ่านแล้ว (อุปกรณ์อื่นจะถูกออกจากระบบ)");
    } catch (e2) {
      setPwErr(e2 instanceof Error ? e2.message : "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    }
  }

  const info = PROVIDERS[provider];

  return (
    <section id="settings" aria-label="ตั้งค่า AI ของฉัน" className="panel">
      <h2>ตั้งค่า AI ของฉัน</h2>
      <p className="muted small" style={{ marginTop: 0 }}>
        ใส่ API key ของคุณเอง ระบบเก็บแบบเข้ารหัสและใช้เฉพาะตอนสร้างคอนเทนต์ให้คุณ ค่าใช้จ่ายเป็นของบัญชีผู้ให้บริการของคุณ
      </p>

      <ul className="key-list">
        {PROVIDER_IDS.map((p) => (
          <li key={p}>
            <span className="name">{PROVIDERS[p].label}</span>
            {me?.keys[p].set ? <span className="ok-text">ตั้งแล้ว •••• {me.keys[p].last4}</span> : <span className="off-text">ยังไม่ได้ตั้ง</span>}
            {me?.provider === p && <span className="pill Active">ใช้อยู่</span>}
            {me?.keys[p].set && <button type="button" className="btn reject small" onClick={() => removeKey(p)}>ลบ key</button>}
          </li>
        ))}
      </ul>

      <div className="form-grid">
        <label className="field">
          <span>ผู้ให้บริการที่ต้องการใช้</span>
          <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
            {PROVIDER_IDS.map((p) => <option key={p} value={p}>{PROVIDERS[p].label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>ชื่อโมเดล (เว้นว่างเพื่อใช้ค่าแนะนำ)</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={info.defaultModel} maxLength={80} />
        </label>
        <label className="field">
          <span>API key ของ {info.label} <a href={info.keyUrl} target="_blank" rel="noreferrer" style={{ color: "var(--blue)" }}>(สร้างที่นี่)</a></span>
          <input type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} placeholder={me?.keys[provider].set ? "ใส่ใหม่เพื่อแทนที่ key เดิม" : info.keyPlaceholder} autoComplete="off" />
        </label>
      </div>
      <div className="gen-actions">
        <button type="button" className="btn approve" disabled={keyDraft.trim().length < 10} onClick={saveKey}>บันทึก API key</button>
        <button type="button" className="btn plain" disabled={!me?.keys[provider].set} onClick={saveProvider}>ใช้ผู้ให้บริการนี้ / บันทึกชื่อโมเดล</button>
      </div>
      {msg && <div className="msg-ok" style={{ marginTop: 12 }}>{msg}</div>}
      {err && <div role="alert" className="form-error" style={{ marginTop: 12 }}>{err}</div>}

      <h3 className="sub-h">เปลี่ยนรหัสผ่าน</h3>
      <form onSubmit={changePw}>
        <div className="form-grid">
          <label className="field">
            <span>รหัสผ่านปัจจุบัน</span>
            <input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" required />
          </label>
          <label className="field">
            <span>รหัสผ่านใหม่ (อย่างน้อย 8 ตัว)</span>
            <input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" minLength={8} required />
          </label>
        </div>
        <button type="submit" className="btn plain" style={{ flex: "0 0 auto", padding: "0 20px" }}>เปลี่ยนรหัสผ่าน</button>
        {pwMsg && <div className="msg-ok" style={{ marginTop: 12 }}>{pwMsg}</div>}
        {pwErr && <div role="alert" className="form-error" style={{ marginTop: 12 }}>{pwErr}</div>}
      </form>
    </section>
  );
}
