// จำกัดอัตราการเรียกแบบง่าย เก็บในหน่วยความจำ
// หมายเหตุ: บน Vercel (serverless) แต่ละ instance นับแยกกัน จึงเป็นเพียงด่านป้องกันเบื้องต้น
// ถ้าต้องการเข้มงวดจริง ให้ใช้ Upstash Redis / Vercel KV แทน
const hits = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return { ok: true, retryAfter: 0 };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}
