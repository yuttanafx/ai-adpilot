"use client";

import { useEffect, useState } from "react";

// ฉากเคลื่อนไหวแนวการตลาดสำหรับหน้าล็อกอิน (CSS/SVG ล้วน ปิดอัตโนมัติถ้าผู้ใช้ตั้งค่าลดการเคลื่อนไหว)
function useCountUp(target: number, ms = 1600, decimals = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / ms, 1);
      setV(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString("en-US");
}

const LINE = "M20,230 C60,220 80,190 120,196 C160,202 175,150 215,144 C255,138 270,160 305,112 C340,64 365,92 400,58 C430,34 455,40 490,18";
const BARS = [38, 62, 48, 86, 70, 112, 138];

export default function LoginScene() {
  const sales = useCountUp(189500);
  const roas = useCountUp(4.18, 1600, 2);
  const ctr = useCountUp(3.9, 1600, 1);

  return (
    <div className="scene" aria-hidden="true">
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div className="grid-bg" />

      <div className="scene-copy">
        <span className="eyebrow">AI สำหรับนักการตลาด</span>
        <h2>ยิงแอดให้ฉลาดขึ้น<br />ให้ AI ช่วยคิด ช่วยวิเคราะห์<br />ช่วยเพิ่มยอดขาย</h2>
      </div>

      <div className="stage">
        <svg className="hero-chart" viewBox="0 0 510 260" fill="none">
          <defs>
            <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3ddc84" stopOpacity="0.35" />
              <stop offset="1" stopColor="#3ddc84" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="gLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#4c8dff" />
              <stop offset="1" stopColor="#3ddc84" />
            </linearGradient>
          </defs>
          {[50, 100, 150, 200].map((y) => <line key={y} x1="10" x2="500" y1={y} y2={y} stroke="#ffffff" strokeOpacity="0.07" />)}
          {BARS.map((h, i) => (
            <rect key={i} className="bar-grow" style={{ animationDelay: `${i * 0.12}s` }} x={36 + i * 64} y={240 - h} width="26" height={h} rx="5" fill="#4c8dff" fillOpacity="0.28" />
          ))}
          <path className="area" d={LINE + " L490,240 L20,240 Z"} fill="url(#gArea)" />
          <path className="line" d={LINE} pathLength={1} stroke="url(#gLine)" strokeWidth="4" strokeLinecap="round" />
          <g className="end-dot">
            <circle cx="490" cy="18" r="14" fill="#3ddc84" fillOpacity="0.25" className="pulse" />
            <circle cx="490" cy="18" r="6" fill="#3ddc84" />
          </g>
        </svg>

        <div className="float-card fc1">
          <span>ยอดขาย</span>
          <b>฿{sales}</b>
          <i className="up">▲ +12%</i>
        </div>
        <div className="float-card fc2">
          <span>ROAS</span>
          <b>{roas}</b>
          <i className="up">▲ +8%</i>
        </div>
        <div className="float-card fc3">
          <span>CTR</span>
          <b>{ctr}%</b>
          <i className="up">▲ +1.1%</i>
        </div>

        <span className="badge bd1">Meta</span>
        <span className="badge bd2">Google</span>
        <span className="badge bd3">TikTok</span>
        <span className="spark s1">✦</span>
        <span className="spark s2">✦</span>
        <span className="spark s3">✦</span>
      </div>
    </div>
  );
}
