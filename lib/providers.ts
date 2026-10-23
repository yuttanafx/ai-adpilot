// ข้อมูลผู้ให้บริการ AI (ใช้ได้ทั้งฝั่งเบราว์เซอร์และเซิร์ฟเวอร์)
export type Provider = "gemini" | "anthropic" | "openai";

export const PROVIDER_IDS: Provider[] = ["gemini", "anthropic", "openai"];

export const PROVIDERS: Record<Provider, { label: string; defaultModel: string; keyUrl: string; keyPlaceholder: string }> = {
  gemini: { label: "Google Gemini", defaultModel: "gemini-3.8-flash", keyUrl: "https://aistudio.google.com/apikey", keyPlaceholder: "AIza…" },
  anthropic: { label: "Anthropic Claude", defaultModel: "claude-sonnet-5-5", keyUrl: "https://console.anthropic.com/settings/keys", keyPlaceholder: "sk-ant-…" },
  openai: { label: "OpenAI GPT", defaultModel: "gpt-6.1-sol", keyUrl: "https://platform.openai.com/api-keys", keyPlaceholder: "sk-…" },
};

export const isProvider = (v: unknown): v is Provider => typeof v === "string" && (PROVIDER_IDS as string[]).includes(v);
