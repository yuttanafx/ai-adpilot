"use client";

import { useState } from "react";
import type { AdPlatform } from "@/lib/data";
import type { MediaRef } from "@/lib/mediaTypes";
import MediaPicker, { deleteMedia, useMediaCaps } from "./MediaPicker";

export type Creative = {
  angle: string;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  audienceNotes: string;
  creativeBrief: string;
  tags: string[];
};

type Props = { onAdd: (c: Creative, platform: AdPlatform, media: MediaRef[]) => void };

export default function CreativeGenerator({ onAdd }: Props) {
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [offer, setOffer] = useState("");
  const [platform, setPlatform] = useState<AdPlatform>("meta");
  const [count, setCount] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [noKey, setNoKey] = useState(false);
  const [results, setResults] = useState<Creative[]>([]);
  const [resultPlatform, setResultPlatform] = useState<AdPlatform>("meta");
  const [added, setAdded] = useState<Set<number>>(new Set());
  const [resultProduct, setResultProduct] = useState("");
  // รูป/วิดีโอที่แนบหรือสร้างให้แต่ละชุด (key = ลำดับชุด)
  const [media, setMedia] = useState<Record<number, MediaRef[]>>({});
  const { caps, reload } = useMediaCaps();

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNoKey(false);
    try {
      const res = await fetch("/api/generate-creatives", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ product, audience, offer, platform, count }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === "NO_KEY") setNoKey(true);
        throw new Error(data.error || "สร้างคอนเทนต์ไม่สำเร็จ");
      }
      // ชุดเดิมที่ยังไม่ได้ส่งเข้าคิวจะถูกแทนที่ → ลบรูป/วิดีโอที่ค้างอยู่ไม่ให้สิ้นเปลืองที่เก็บ
      deleteMedia(Object.entries(media).filter(([i]) => !added.has(Number(i))).flatMap(([, v]) => v.map((m) => m.id)));
      setMedia({});
      setResults(data.creatives as Creative[]);
      setResultPlatform(platform);
      setResultProduct(product);
      setAdded(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างคอนเทนต์ไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="generate" aria-label="สร้างคอนเทนต์โฆษณาด้วย AI" className="panel">
      <h2>สร้างคอนเทนต์โฆษณาด้วย AI</h2>
      <form onSubmit={generate}>
        <div className="form-grid">
          <label className="field">
            <span>สินค้า / บริการ *</span>
            <input value={product} onChange={(e) => setProduct(e.target.value)} maxLength={300} placeholder="เช่น ครีมกันแดด SPF50" required />
          </label>
          <label className="field">
            <span>กลุ่มเป้าหมาย *</span>
            <input value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={300} placeholder="เช่น ผู้หญิง 25-40 ปี ทำงานออฟฟิศ" required />
          </label>
          <label className="field">
            <span>โปรโมชัน (ถ้ามี)</span>
            <input value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={200} placeholder="เช่น ลด 20% สัปดาห์นี้" />
          </label>
          <label className="field">
            <span>แพลตฟอร์ม</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as AdPlatform)}>
              <option value="meta">Meta (Facebook / Instagram)</option>
              <option value="google">Google</option>
              <option value="tiktok">TikTok</option>
            </select>
          </label>
          <label className="field">
            <span>จำนวนชุดที่ต้องการ</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 8].map((n) => <option key={n} value={n}>{n} ชุด</option>)}
            </select>
          </label>
        </div>
        <div className="gen-actions">
          <button type="submit" className="btn approve" disabled={busy}>{busy ? "AI กำลังเขียน…" : "สร้างคอนเทนต์"}</button>
          <span className="muted">AI อาจเขียนผิดพลาดได้ ตรวจสอบคำโฆษณาก่อนอนุมัติเสมอ</span>
        </div>
        {error && (
          <div role="alert" className="form-error" style={{ marginTop: 12 }}>
            {error} {noKey && <a href="#settings" style={{ textDecoration: "underline" }}>ไปที่ตั้งค่า AI</a>}
          </div>
        )}
      </form>

      {results.length > 0 && (
        <div className="cards" style={{ marginTop: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
          {results.map((c, i) => (
            <div key={i} className="result-card">
              <span className="angle">{c.angle}</span>
              <span className="hl">{c.headline}</span>
              <span>{c.primaryText}</span>
              {c.description && <span className="meta-line">คำอธิบาย: {c.description}</span>}
              {c.cta && <span className="meta-line">ปุ่ม CTA: {c.cta}</span>}
              {c.audienceNotes && <span className="meta-line">กลุ่มเป้าหมาย: {c.audienceNotes}</span>}
              {c.creativeBrief && <span className="meta-line">ภาพ/วิดีโอ: {c.creativeBrief}</span>}
              {c.tags.length > 0 && <div className="tags">{c.tags.map((t) => <span key={t}>{t}</span>)}</div>}
              <MediaPicker
                value={media[i] ?? []}
                onChange={(v) => setMedia((prev) => ({ ...prev, [i]: v }))}
                caps={caps}
                reloadCaps={reload}
                platform={resultPlatform}
                disabled={added.has(i)}
                defaultPrompt={`${c.creativeBrief || c.headline}${resultProduct ? `\nสินค้า/บริการ: ${resultProduct}` : ""}`}
              />
              <button
                type="button"
                className="btn approve"
                disabled={added.has(i)}
                onClick={() => {
                  onAdd(c, resultPlatform, media[i] ?? []);
                  setAdded(new Set(added).add(i));
                }}
              >
                {added.has(i) ? "ส่งเข้าคิวแล้ว" : "ส่งเข้าคิวอนุมัติ"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
