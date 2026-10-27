"use client";

import { useState } from "react";

const HEYGEN_URL = "https://app.heygen.com/home";

export default function LivePanel() {
  const [key, setKey] = useState(0); // เปลี่ยนค่าเพื่อโหลดกรอบใหม่
  const [loaded, setLoaded] = useState(false);
  const [height, setHeight] = useState(640);

  function openPopup() {
    const w = Math.min(1280, window.screen.availWidth - 80);
    const h = Math.min(860, window.screen.availHeight - 80);
    window.open(HEYGEN_URL, "heygen", `popup=yes,width=${w},height=${h},noopener`);
  }

  return (
    <section id="live" aria-label="ไลฟ์ (HeyGen)" className="panel">
      <div className="live-head">
        <h2>ไลฟ์ (HeyGen)</h2>
        <div className="live-actions">
          <button type="button" className="btn plain" onClick={() => { setLoaded(false); setKey((k) => k + 1); }}>
            โหลดใหม่
          </button>
          <button type="button" className="btn plain" onClick={() => setHeight((h) => (h >= 900 ? 640 : h + 260))}>
            {height >= 900 ? "ย่อกรอบ" : "ขยายกรอบ"}
          </button>
          <button type="button" className="btn plain" onClick={openPopup}>เปิดเป็นหน้าต่างแยก</button>
          <a className="btn approve live-link" href={HEYGEN_URL} target="_blank" rel="noopener noreferrer">
            เปิดในแท็บใหม่
          </a>
        </div>
      </div>

      <div className="live-frame" style={{ height }}>
        {!loaded && <p className="muted live-loading">กำลังโหลด HeyGen…</p>}
        <iframe
          key={key}
          src={HEYGEN_URL}
          title="HeyGen"
          onLoad={() => setLoaded(true)}
          allow="camera; microphone; clipboard-read; clipboard-write; fullscreen; autoplay; display-capture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>

      <p className="muted live-note">
        ถ้ากรอบด้านบนขึ้นเป็นหน้าว่าง/ปฏิเสธการเชื่อมต่อ แปลว่า HeyGen ไม่อนุญาตให้ฝังหน้าเว็บของเขาในเว็บอื่น
        ให้กด "เปิดเป็นหน้าต่างแยก" หรือ "เปิดในแท็บใหม่" แทน (ล็อกอิน HeyGen ครั้งเดียวก็ใช้ต่อได้)
      </p>
    </section>
  );
}
