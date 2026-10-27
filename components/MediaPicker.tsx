"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdPlatform } from "@/lib/data";
import {
  ASPECT_LABEL,
  IMAGE_ASPECTS,
  IMAGE_MIMES,
  MAX_MEDIA_PER_ITEM,
  VIDEO_ASPECTS,
  VIDEO_MIMES,
  mediaUrl,
  type Aspect,
  type MediaCaps,
  type MediaKind,
  type MediaRef,
} from "@/lib/mediaTypes";
import { PROVIDERS, type Provider } from "@/lib/providers";

// ดึงว่าผู้ใช้ใช้ฟีเจอร์รูป/วิดีโออะไรได้บ้าง (undefined = กำลังโหลด, null = โหลดไม่ได้)
export function useMediaCaps() {
  const [caps, setCaps] = useState<MediaCaps | null | undefined>(undefined);
  const reload = useCallback(() => {
    fetch("/api/media/capabilities")
      .then((r) => (r.ok ? (r.json() as Promise<MediaCaps>) : null))
      .then(setCaps)
      .catch(() => setCaps(null));
  }, []);
  useEffect(reload, [reload]);
  return { caps, reload };
}

// ลบไฟล์ออกจากที่เก็บ (ไม่รอผล)
export function deleteMedia(ids: string[]) {
  for (const id of ids) fetch(mediaUrl(id), { method: "DELETE", keepalive: true }).catch(() => {});
}

const EXT_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
};
const guessMime = (f: File) => f.type || EXT_MIME[f.name.split(".").pop()?.toLowerCase() ?? ""] || "";

function putFile(url: string, headers: Record<string, string>, file: File, onProgress: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`อัปโหลดไม่สำเร็จ (รหัส ${x.status})`)));
    x.onerror = () => reject(new Error("อัปโหลดไม่สำเร็จ ตรวจสอบอินเทอร์เน็ต หรือการตั้งค่า CORS ของ Firebase Storage (ดู README)"));
    x.send(file);
  });
}

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("กรุณาเข้าสู่ระบบใหม่");
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || (res.status === 504 || res.status === 502 ? "เซิร์ฟเวอร์ตัดการเชื่อมต่อเพราะใช้เวลานานเกินไป (บน Vercel แผนฟรีรันได้ไม่เกิน 60 วินาที)" : `ทำรายการไม่สำเร็จ (รหัส ${res.status})`));
  }
  return data;
}

type Props = {
  value: MediaRef[];
  onChange: (v: MediaRef[]) => void;
  caps: MediaCaps | null | undefined;
  reloadCaps: () => void;
  defaultPrompt: string; // คำอธิบายเริ่มต้นสำหรับให้ AI สร้างภาพ/วิดีโอ (ผู้ใช้แก้ได้)
  platform: AdPlatform;
  disabled?: boolean;
  deferDelete?: boolean; // true = ไม่ลบไฟล์ทันทีที่กดเอาออก (ให้ผู้เรียกจัดการเอง เช่นตอนแก้ไขในคิว)
};

export default function MediaPicker({ value, onChange, caps, reloadCaps, defaultPrompt, platform, disabled, deferDelete }: Props) {
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);
  const [panel, setPanel] = useState<MediaKind | null>(null);
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<Aspect>("1:1");
  const [provider, setProvider] = useState<Provider | "">("");
  const [useFrame, setUseFrame] = useState(false);
  const [busy, setBusy] = useState<null | "upload" | MediaKind>(null);
  const [pct, setPct] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const full = value.length >= MAX_MEDIA_PER_ITEM;
  const noStorage = caps?.storage === null;
  const lastImage = [...value].reverse().find((m) => m.kind === "image");
  const working = busy !== null;

  useEffect(() => {
    if (busy !== "video" && busy !== "image") return;
    setElapsed(0);
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  function openPanel(kind: MediaKind) {
    if (panel === kind) return setPanel(null);
    setError("");
    reloadCaps(); // เผื่อเพิ่งใส่ API key ในหน้าตั้งค่า
    setPanel(kind);
    if (!prompt.trim()) setPrompt(defaultPrompt);
    const list = kind === "video" ? VIDEO_ASPECTS : IMAGE_ASPECTS;
    const wanted: Aspect = platform === "tiktok" ? "9:16" : kind === "video" ? (platform === "google" ? "16:9" : "9:16") : "1:1";
    setAspect(list.includes(wanted) ? wanted : list[0]);
    setUseFrame(false);
  }

  const providers: Provider[] = panel ? (caps?.[panel] ?? []) : [];
  const chosen: Provider | "" = provider && providers.includes(provider) ? provider : providers[0] ?? "";

  async function attach(kind: MediaKind, file: File | undefined) {
    if (!file) return;
    setError("");
    const mime = guessMime(file);
    const maxMB = kind === "image" ? caps?.maxImageMB ?? 10 : caps?.maxVideoMB ?? 200;
    if (!(kind === "image" ? IMAGE_MIMES : VIDEO_MIMES).includes(mime)) {
      return setError(kind === "image" ? "รองรับรูป JPG / PNG / WebP / GIF เท่านั้น" : "รองรับวิดีโอ MP4 / MOV / WebM เท่านั้น");
    }
    if (file.size > maxMB * 1048576) return setError(`ไฟล์ใหญ่เกินกำหนด (สูงสุด ${maxMB} MB)`);
    setBusy("upload");
    setPct(0);
    try {
      const init = await apiJson<{ id: string; uploadUrl: string; headers: Record<string, string> }>("/api/media/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, mime, size: file.size, name: file.name }),
      });
      await putFile(init.uploadUrl, init.headers, file, setPct);
      const done = await apiJson<{ media: MediaRef }>(mediaUrl(init.id), { method: "POST" });
      onChange([...value, done.media]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "แนบไฟล์ไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!panel || !chosen) return;
    setError("");
    setBusy(panel);
    try {
      const body = { kind: panel, prompt, aspect, provider: chosen, firstFrameId: panel === "video" && useFrame && lastImage ? lastImage.id : undefined };
      const out = await apiJson<{ media: MediaRef }>("/api/media/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      onChange([...value, out.media]);
      setPanel(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างไม่สำเร็จ");
    } finally {
      setBusy(null);
    }
  }

  function remove(m: MediaRef) {
    onChange(value.filter((x) => x.id !== m.id));
    if (!deferDelete) deleteMedia([m.id]);
  }

  const off = disabled || working || noStorage;
  const aspects = panel === "video" ? VIDEO_ASPECTS : IMAGE_ASPECTS;

  return (
    <div className="media-box">
      {value.length > 0 && (
        <div className="media-grid">
          {value.map((m) => (
            <div key={m.id} className="media-item">
              {m.kind === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(m.id)} alt={m.name || "รูปโฆษณา"} loading="lazy" />
              ) : (
                <video src={mediaUrl(m.id)} controls preload="metadata" playsInline />
              )}
              <span className="media-badge">{m.source === "ai" ? "AI" : m.kind === "image" ? "รูป" : "วิดีโอ"}</span>
              {!disabled && (
                <button type="button" className="media-x" aria-label={`เอา ${m.name || "ไฟล์"} ออก`} onClick={() => remove(m)} disabled={working}>
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!disabled && (
        <>
          <div className="media-tools">
            <button type="button" className="btn plain small" disabled={off || full} onClick={() => imgInput.current?.click()}>แนบรูป</button>
            <button type="button" className="btn plain small" disabled={off || full} onClick={() => vidInput.current?.click()}>แนบวิดีโอ</button>
            <button type="button" className={"btn small " + (panel === "image" ? "approve" : "plain")} disabled={off || full} onClick={() => openPanel("image")}>สร้างรูปด้วย AI</button>
            <button type="button" className={"btn small " + (panel === "video" ? "approve" : "plain")} disabled={off || full} onClick={() => openPanel("video")}>สร้างวิดีโอด้วย AI</button>
            <input ref={imgInput} type="file" accept={IMAGE_MIMES.join(",")} hidden onChange={(e) => { void attach("image", e.target.files?.[0]); e.target.value = ""; }} />
            <input ref={vidInput} type="file" accept={VIDEO_MIMES.join(",") + ",.mov"} hidden onChange={(e) => { void attach("video", e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          {full && <span className="meta-line">แนบได้สูงสุด {MAX_MEDIA_PER_ITEM} ไฟล์ต่อชุด</span>}
          {noStorage && (
            <span className="meta-line">ยังไม่ได้ตั้งที่เก็บไฟล์บนเซิร์ฟเวอร์ (FIREBASE_STORAGE_BUCKET) จึงแนบ/สร้างรูปและวิดีโอยังไม่ได้ — ดู README</span>
          )}
          {busy === "upload" && <span className="meta-line" role="status">กำลังอัปโหลด… {pct}%</span>}
        </>
      )}

      {panel && !disabled && !noStorage && (
        <div className="media-panel">
          {providers.length === 0 ? (
            <div className="form-error" role="alert">
              {panel === "video"
                ? "สร้างวิดีโอด้วย AI ได้เฉพาะ Gemini — กรุณาใส่ API key ของ Gemini ที่ส่วน “ตั้งค่า AI” ก่อน (OpenAI ปิดบริการวิดีโอแล้ว และ Claude ยังไม่มีบริการสร้างวิดีโอ)"
                : "สร้างรูปด้วย AI ได้กับ Gemini หรือ OpenAI — กรุณาใส่ API key ของอย่างใดอย่างหนึ่งที่ส่วน “ตั้งค่า AI” ก่อน (Claude ยังไม่มีบริการสร้างรูป)"}{" "}
              <a href="#settings" style={{ textDecoration: "underline" }}>ไปที่ตั้งค่า AI</a>
            </div>
          ) : (
            <>
              <label className="field">
                <span>{panel === "video" ? "อธิบายวิดีโอที่ต้องการ" : "อธิบายภาพที่ต้องการ"} (แก้ไขได้)</span>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={2000} rows={4} disabled={working} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>สัดส่วน</span>
                  <select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)} disabled={working}>
                    {aspects.map((a) => <option key={a} value={a}>{ASPECT_LABEL[a]}</option>)}
                  </select>
                </label>
                {providers.length > 1 && (
                  <label className="field">
                    <span>ใช้บริการ</span>
                    <select value={chosen} onChange={(e) => setProvider(e.target.value as Provider)} disabled={working}>
                      {providers.map((p) => <option key={p} value={p}>{PROVIDERS[p].label}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {panel === "video" && lastImage && (
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                  <input type="checkbox" checked={useFrame} onChange={(e) => setUseFrame(e.target.checked)} disabled={working} />
                  ใช้รูปที่แนบไว้ล่าสุดเป็นภาพแรกของวิดีโอ (ทำให้รูปขยับ)
                </label>
              )}
              <span className="meta-line">
                {panel === "video"
                  ? "ใช้เวลาประมาณ 1–4 นาที ค่าใช้จ่ายคิดกับ API key ของคุณ ภาพที่ได้ไม่มีตัวอักษรหรือโลโก้ (ข้อความโฆษณาแสดงแยกต่างหาก) ตรวจสอบก่อนอนุมัติเสมอ"
                  : "ค่าใช้จ่ายคิดกับ API key ของคุณ ภาพที่ได้ไม่มีตัวอักษรหรือโลโก้ (ข้อความโฆษณาแสดงแยกต่างหาก) ตรวจสอบก่อนอนุมัติเสมอ"}
              </span>
              <div className="gen-actions">
                <button type="button" className="btn approve" disabled={working || prompt.trim().length < 5} onClick={generate}>
                  {busy === panel ? (panel === "video" ? `กำลังสร้างวิดีโอ… ${elapsed} วิ` : `กำลังสร้างรูป… ${elapsed} วิ`) : panel === "video" ? "สร้างวิดีโอ" : "สร้างรูป"}
                </button>
                <button type="button" className="btn plain" disabled={working} onClick={() => setPanel(null)}>ปิด</button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <div role="alert" className="form-error">{error}</div>}
    </div>
  );
}
