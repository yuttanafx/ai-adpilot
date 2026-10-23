"use client";

import { useCallback, useEffect, useState } from "react";
import { PROVIDERS, type Provider } from "@/lib/providers";

type U = {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "user";
  active: boolean;
  createdAt: string;
  lastLogin: string | null;
  provider: Provider;
  keysSet: Provider[];
};

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }) : "ยังไม่เคยเข้า";

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "ทำรายการไม่สำเร็จ");
  return data;
}

export default function AdminPanel({ meId }: { meId: string }) {
  const [users, setUsers] = useState<U[]>([]);
  const [err, setErr] = useState("");
  const [secret, setSecret] = useState<{ who: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", password: "", role: "user" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/api/admin/users", "GET");
      setUsers(d.users);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function act(fn: () => Promise<{ password?: string } | void>, who?: string) {
    setErr("");
    try {
      const r = await fn();
      if (r && r.password && who) {
        setSecret({ who, password: r.password });
        setCopied(false);
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await act(async () => {
      const r = await api("/api/admin/users", "POST", form);
      setForm({ username: "", displayName: "", password: "", role: "user" });
      return r;
    }, form.username.toLowerCase());
    setBusy(false);
  }

  return (
    <div className="admin-wrap">
      <div className="admin-top">
        <h1>จัดการผู้ใช้</h1>
        <a href="/" className="btn plain" style={{ flex: "0 0 auto", padding: "0 16px", display: "inline-flex", alignItems: "center" }}>← กลับแดชบอร์ด</a>
      </div>

      {secret && (
        <div className="secret-box" role="status">
          <span>รหัสผ่านของ <b>{secret.who}</b> (แสดงครั้งเดียว กรุณาคัดลอกส่งให้ผู้ใช้):</span>
          <code>{secret.password}</code>
          <button
            type="button"
            className="btn plain small"
            onClick={() => navigator.clipboard?.writeText(secret.password).then(() => setCopied(true))}
          >{copied ? "คัดลอกแล้ว" : "คัดลอก"}</button>
          <button type="button" className="btn plain small" onClick={() => setSecret(null)}>ปิด</button>
        </div>
      )}
      {err && <div role="alert" className="form-error">{err}</div>}

      <section className="panel" aria-label="สร้างผู้ใช้ใหม่">
        <h2>สร้างผู้ใช้ใหม่</h2>
        <form onSubmit={create}>
          <div className="form-grid">
            <label className="field">
              <span>ชื่อผู้ใช้ (อังกฤษ/ตัวเลข) *</span>
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} pattern="[A-Za-z0-9._\-]{3,32}" required autoCapitalize="none" />
            </label>
            <label className="field">
              <span>ชื่อที่แสดง</span>
              <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} maxLength={80} />
            </label>
            <label className="field">
              <span>รหัสผ่าน (เว้นว่างให้ระบบสุ่มให้)</span>
              <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} minLength={8} autoComplete="off" />
            </label>
            <label className="field">
              <span>บทบาท</span>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="user">ผู้ใช้ทั่วไป</option>
                <option value="admin">ผู้ดูแลระบบ</option>
              </select>
            </label>
          </div>
          <button type="submit" className="btn approve" style={{ flex: "0 0 auto", padding: "0 24px" }} disabled={busy}>สร้างผู้ใช้</button>
        </form>
      </section>

      <section className="panel" aria-label="รายชื่อผู้ใช้">
        <h2>ผู้ใช้ทั้งหมด ({users.length})</h2>
        <p className="muted small" style={{ marginTop: 0 }}>แอดมินเห็นเฉพาะสถานะว่าตั้ง API key แล้วหรือยัง ไม่เห็นตัว key และดูรหัสผ่านเดิมของผู้ใช้ไม่ได้ (ทำได้แค่รีเซ็ตเป็นรหัสใหม่)</p>
        <div className="scroll">
          <table style={{ minWidth: 820 }}>
            <thead>
              <tr><th>ผู้ใช้</th><th>บทบาท</th><th>สถานะ</th><th>AI ที่ตั้งไว้</th><th>เข้าล่าสุด</th><th>จัดการ</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === meId;
                return (
                  <tr key={u.id}>
                    <td><div style={{ fontWeight: 600 }}>{u.displayName}</div><div className="muted small">{u.username}</div></td>
                    <td><span className={"pill role-" + u.role}>{u.role === "admin" ? "แอดมิน" : "ผู้ใช้"}</span></td>
                    <td><span className={"pill " + (u.active ? "Active" : "Paused")}>{u.active ? "ใช้งานได้" : "ถูกระงับ"}</span></td>
                    <td>
                      {u.keysSet.length ? <span className="ok-text">{u.keysSet.map((k) => PROVIDERS[k].label.split(" ")[1] ?? k).join(", ")}</span> : <span className="off-text">ยังไม่ได้ตั้ง key</span>}
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmt(u.lastLogin)}</td>
                    <td>
                      <div className="actions">
                        <button type="button" className="btn plain small" onClick={() => confirm(`รีเซ็ตรหัสผ่านของ ${u.username}? ผู้ใช้จะถูกออกจากระบบทุกอุปกรณ์`) && act(() => api(`/api/admin/users/${u.id}`, "PATCH", { resetPassword: true }), u.username)}>รีเซ็ตรหัสผ่าน</button>
                        {!self && (
                          <>
                            <button type="button" className="btn plain small" onClick={() => act(() => api(`/api/admin/users/${u.id}`, "PATCH", { active: !u.active }))}>{u.active ? "ระงับ" : "เปิดใช้งาน"}</button>
                            <button type="button" className="btn plain small" onClick={() => act(() => api(`/api/admin/users/${u.id}`, "PATCH", { role: u.role === "admin" ? "user" : "admin" }))}>{u.role === "admin" ? "ลดเป็นผู้ใช้" : "ตั้งเป็นแอดมิน"}</button>
                            <button type="button" className="btn reject small" onClick={() => confirm(`ลบผู้ใช้ ${u.username} และข้อมูลทั้งหมดของเขา?`) && act(() => api(`/api/admin/users/${u.id}`, "DELETE"))}>ลบ</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
