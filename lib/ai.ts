import { AppError } from "./db";
import { PROVIDERS, type Provider } from "./providers";

export type AiResult = { text: string; truncated: boolean };

// แปลงสถานะ HTTP จากผู้ให้บริการเป็นข้อความที่เข้าใจง่าย (ไม่ log และไม่ส่ง key กลับไป)
function providerError(provider: Provider, status: number): AppError {
  const name = PROVIDERS[provider].label;
  if (status === 400 || status === 401 || status === 403)
    return new AppError(`${name} ปฏิเสธคำขอ: API key ไม่ถูกต้อง หมดสิทธิ์ หรือชื่อโมเดลไม่ถูกต้อง ตรวจสอบในหน้าตั้งค่า`, 502, "BAD_KEY");
  if (status === 404) return new AppError(`${name}: ไม่พบโมเดลที่ระบุ ตรวจสอบชื่อโมเดลในหน้าตั้งค่า`, 502, "BAD_MODEL");
  if (status === 429) return new AppError(`${name}: ใช้งานเกินโควตาหรือเรียกถี่เกินไป กรุณารอสักครู่หรือตรวจสอบบัญชีของคุณ`, 502, "QUOTA");
  return new AppError(`${name} ขัดข้องชั่วคราว (รหัส ${status}) กรุณาลองใหม่`, 502);
}

async function post(provider: Provider, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(55_000) });
  } catch {
    throw new AppError(`เชื่อมต่อ ${PROVIDERS[provider].label} ไม่ได้หรือใช้เวลานานเกินไป กรุณาลองใหม่`, 504);
  }
}

export async function generate(provider: Provider, apiKey: string, model: string, prompt: string): Promise<AiResult> {
  const m = model || PROVIDERS[provider].defaultModel;

  if (provider === "gemini") {
    const res = await post(provider, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8192, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) throw providerError(provider, res.status);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
    const cand = data.candidates?.[0];
    const text = (cand?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
    if (!text && cand?.finishReason && cand.finishReason !== "STOP")
      throw new AppError("Gemini ไม่ตอบกลับ (อาจถูกกรองเนื้อหา) ลองปรับข้อความสินค้า/โปรโมชัน", 502);
    return { text, truncated: cand?.finishReason === "MAX_TOKENS" };
  }

  if (provider === "anthropic") {
    const res = await post(provider, "https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: m, max_tokens: 6000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!res.ok) throw providerError(provider, res.status);
    const data = (await res.json()) as { content: { type: string; text?: string }[]; stop_reason?: string };
    return {
      text: data.content.map((b) => (b.type === "text" ? b.text ?? "" : "")).join("").trim(),
      truncated: data.stop_reason === "max_tokens",
    };
  }

  const res = await post(provider, "https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: m, input: prompt, max_output_tokens: 8000 }),
  });
  if (!res.ok) throw providerError(provider, res.status);
  const data = (await res.json()) as {
    status?: string;
    incomplete_details?: { reason?: string } | null;
    output?: { type: string; content?: { type: string; text?: string }[] }[];
  };
  const text = (data.output ?? [])
    .filter((o) => o.type === "message")
    .flatMap((o) => o.content ?? [])
    .filter((c) => c.type === "output_text")
    .map((c) => c.text ?? "")
    .join("")
    .trim();
  return { text, truncated: data.status === "incomplete" && data.incomplete_details?.reason === "max_output_tokens" };
}
