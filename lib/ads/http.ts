import { AppError } from "../db";

// เรียก API ภายนอกพร้อม timeout (ไม่ log URL เพราะอาจมี token)
export async function fetchRaw(label: string, url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(25_000) });
  } catch {
    throw new AppError(`เชื่อมต่อ ${label} ไม่ได้หรือใช้เวลานานเกินไป กรุณาลองใหม่`, 504);
  }
}
