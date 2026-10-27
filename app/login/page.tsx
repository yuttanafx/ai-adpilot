"use client";

import { useState } from "react";
import LoginScene from "@/components/LoginScene";
import { BRAND_NAME } from "@/lib/brand";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        // ตรวจว่าเบราว์เซอร์เก็บคุกกี้ไว้จริง (ในกรอบ iframe บางเบราว์เซอร์บล็อกคุกกี้ข้ามเว็บ)
        const me = await fetch("/api/me", { cache: "no-store" });
        if (me.ok) {
          window.location.href = "/" + window.location.hash; // คงตำแหน่ง เช่น #queue
          return;
        }
        const framed = window.self !== window.top;
        setError(
          framed
            ? "เข้าสู่ระบบสำเร็จ แต่เบราว์เซอร์บล็อกคุกกี้ในกรอบนี้ (พบบ่อยใน Safari / iPhone / โหมดไม่ระบุตัวตน) กรุณากด “เปิดในแท็บใหม่” เพื่อใช้งาน"
            : "เข้าสู่ระบบสำเร็จ แต่เบราว์เซอร์ไม่ยอมเก็บคุกกี้ กรุณาเปิดการใช้งานคุกกี้แล้วลองใหม่",
        );
        setBusy(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "เข้าสู่ระบบไม่สำเร็จ");
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่");
    }
    setBusy(false);
  }

  return (
    <main className="login-page">
      <LoginScene />
      <section className="login-side">
        <form className="login-box" onSubmit={submit}>
          <div className="login-brand">
            <svg width="34" height="34" viewBox="0 0 30 30" fill="none" aria-hidden="true">
              <path d="M3 27L14 3l5 11" stroke="#4c8dff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M11 27l8-14 8 14" stroke="#7fe0a8" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h1>{BRAND_NAME}</h1>
          </div>
          <p className="muted">เข้าสู่ระบบด้วยบัญชีที่ผู้ดูแลระบบสร้างให้</p>
          <label className="field">
            <span>ชื่อผู้ใช้</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" autoCapitalize="none" required />
          </label>
          <label className="field">
            <span>รหัสผ่าน</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
          </label>
          {error && <div role="alert" className="form-error">{error}</div>}
          <button type="submit" className="btn approve" disabled={busy}>{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
          <p className="muted small">ยังไม่มีบัญชี? ติดต่อผู้ดูแลระบบเพื่อขอรหัสผ่าน</p>
        </form>
      </section>
    </main>
  );
}
