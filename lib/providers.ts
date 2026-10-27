// ข้อมูลผู้ให้บริการ AI (ใช้ได้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์)
export type Provider = "gemini" | "anthropic" | "openai";

export const PROVIDER_IDS: Provider[] = ["gemini", "anthropic", "openai"];

export const PROVIDERS: Record<Provider, { label: string; defaultModel: string; keyUrl: string; keyPlaceholder: string }> = {
  gemini: { label: "Google Gemini", defaultModel: "gemini-3.8-flash", keyUrl: "https://aistudio.google.com/apikey", keyPlaceholder: "AIza…" },
  anthropic: { label: "Anthropic Claude", defaultModel: "claude-sonnet-5-5", keyUrl: "https://console.anthropic.com/settings/keys", keyPlaceholder: "sk-ant-…" },
  openai: { label: "OpenAI GPT", defaultModel: "gpt-6.1-sol", keyUrl: "https://platform.openai.com/api-keys", keyPlaceholder: "sk-…" },
};

export const isProvider = (v: unknown): v is Provider => typeof v === "string" && (PROVIDER_IDS as string[]).includes(v);

// ---------- สร้างรูป/วิดีโอด้วย AI ----------
// หมายเหตุ: Claude (Anthropic) ยังไม่มี API สร้างรูป/วิดีโอ และ OpenAI ปิด Sora/Videos API ไปแล้ว (24 ก.ย. 2026)
// จึงสร้างรูปได้ด้วย Gemini และ GPT Image ส่วนสร้างวิดีโอได้ด้วย Gemini เท่านั้น
// ชื่อโมเดลเปลี่ยนเร็ว — เซิร์ฟเวอร์ override ได้ด้วย GEMINI_IMAGE_MODEL / OPENAI_IMAGE_MODEL / GEMINI_VIDEO_MODEL
export const IMAGE_PROVIDERS: Provider[] = ["gemini", "openai"];
export const VIDEO_PROVIDERS: Provider[] = ["gemini"];
export const MEDIA_DEFAULT_MODELS = {
  geminiImage: "gemini-3.1-flash-image",
  openaiImage: "gpt-image-2",
  geminiVideo: "gemini-omni-1.1-flash",
} as const;
