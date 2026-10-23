"use client";

import { useState } from "react";
import { BRAND_NAME } from "@/lib/brand";

export default function LoginPage() {
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
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = "/";
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
    <main className="login">
      <form className="panel login-box" onSubmit={submit}>
        <h1>{BRAND_NAME}</h1>
        <p className="muted">กรุณาใส่รหัสผ่านเพื่อเข้าใช้งาน</p>
        <label className="field">
          <span>รหัสผ่าน</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" required />
        </label>
        {error && <div role="alert" className="form-error">{error}</div>}
        <button type="submit" className="btn approve" disabled={busy}>{busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}</button>
      </form>
    </main>
  );
}
