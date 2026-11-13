"use client";

import Link from "next/link";
import { useState } from "react";
import LoginScene from "@/components/LoginScene";
import { BRAND_NAME } from "@/lib/brand";

export default function RegisterPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, displayName, password }),
      });
      if (res.ok) {
        // ตรวจว่าเบราว์เซอร์เก็บคุกกี้ไว้จริง (ในกรอบ iframe บางเบราว์เซอร์บล็อกคุกกี้ข้ามเว็บ)
        const me = await fetch("/api/me", { cache: "no-store" });
        if (me.ok) {
          window.location.href = "/";
          return;
        }
        const framed = window.self !== window.top;
        setError(
          framed
            ? "สมัครสำเร็จ แต่เบราว์เซอร์บล็อกคุกกี้ในกรอบนี้ (พบบ่อยใน Safari / iPhone / โหมดไม่ระบุตัวตน) กรุณากด “เปิดในแท็บใหม่” แล้วเข้าสู่ระบบ"
            : "สมัครสำเร็จ แต่เบราว์เซอร์ไม่ยอมเก็บคุกกี้ กรุณาเปิดการใช้งานคุกกี้ แล้วเข้าสู่ระบบ",
        );
        setBusy(false);
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || "สมัครสมาชิกไม่สำเร็จ");
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
          <p className="muted">สมัครสมาชิกใหม่ เพื่อเริ่มใช้งานได้ทันที</p>
          <label className="field">
            <span>ชื่อที่แสดง (ไม่บังคับ)</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" maxLength={80} />
          </label>
          <label className="field">
            <span>ชื่อผู้ใช้ (อังกฤษ/ตัวเลข . _ - ยาว 3–32 ตัว)</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" autoCapitalize="none" pattern="[A-Za-z0-9._\-]{3,32}" required />
          </label>
          <label className="field">
            <span>รหัสผ่าน (อย่างน้อย 8 ตัวอักษร)</span>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
          </label>
          <label className="field">
            <span>ยืนยันรหัสผ่าน</span>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required />
          </label>
          {error && <div role="alert" className="form-error">{error}</div>}
          <button type="submit" className="btn approve" disabled={busy}>{busy ? "กำลังสมัคร…" : "สมัครสมาชิก"}</button>
          <p className="muted small">มีบัญชีแล้ว? <Link href="/login">เข้าสู่ระบบ</Link></p>
        </form>
      </section>
    </main>
  );
}
