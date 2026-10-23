import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  product?: string;
  audience?: string;
  platform?: "meta" | "google" | "tiktok";
  offer?: string;
  count?: number;
};

const LIMITS = {
  meta: "Headline up to 40 characters, primary text up to 125 characters, description up to 30 characters.",
  google: "Headlines up to 30 characters, descriptions up to 90 characters.",
  tiktok: "Ad text up to 100 characters, plus a 15 second video script.",
} as const;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not set" }, { status: 500 });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { product, audience, platform = "meta", offer = "", count = 3 } = body;
  if (!product || !audience) {
    return NextResponse.json({ error: "product and audience are required" }, { status: 400 });
  }
  const n = Math.min(Math.max(Number(count) || 3, 1), 8);

  const prompt = `You write paid-social and search ad creatives.

Product: ${product}
Audience: ${audience}
Offer: ${offer || "none"}
Platform: ${platform}
Platform limits: ${LIMITS[platform]}

Write ${n} distinct creatives, each with a different sales angle (for example discount, social proof, problem-solution, scarcity).
Do not invent statistics, prices or guarantees that are not in the input. Avoid claims that platform ad policies prohibit.
Write the ad copy in the same language as the product and audience description.

Return ONLY a JSON array. Each item has these keys:
"angle", "headline", "primaryText", "description", "cta", "audienceNotes", "creativeBrief" (what the image or video should show), "tags" (array of short strings).`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5-5",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return NextResponse.json({ error: `Anthropic API ${res.status}: ${detail.slice(0, 300)}` }, { status: 502 });
    }
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    const text = data.content
      .map((b) => (b.type === "text" ? b.text ?? "" : ""))
      .join("")
      .trim();
    const json = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const creatives = JSON.parse(json);
    return NextResponse.json({ creatives });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
