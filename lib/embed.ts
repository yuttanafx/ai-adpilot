// รองรับการฝังเว็บนี้เป็น iframe ในเว็บอื่น (ตั้ง EMBED_ORIGINS=https://เว็บที่ฝัง ได้หลายตัวคั่นด้วย ,)
// ไม่ตั้ง = ไม่อนุญาตให้ใครฝัง (กัน clickjacking) และใช้คุกกี้แบบ SameSite=Lax ตามปกติ
export function embedOrigins(): string[] {
  return (process.env.EMBED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().replace(/\/+$/, ""))
    .filter((o) => /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(o)); // กรองรูปแบบ กัน header injection
}

// คุกกี้ในกรอบ iframe ข้ามเว็บ (third-party) จะถูกส่งก็ต่อเมื่อเป็น SameSite=None; Secure
// และใส่ Partitioned (CHIPS) เพื่อให้ทำงานได้แม้เบราว์เซอร์บล็อกคุกกี้ข้ามเว็บ (เช่น Chrome โหมดไม่ระบุตัวตน)
export function sessionCookieOptions(maxAge: number) {
  const embed = embedOrigins().length > 0 && process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    sameSite: (embed ? "none" : "lax") as "none" | "lax",
    secure: embed || process.env.NODE_ENV === "production",
    partitioned: embed ? true : undefined,
    path: "/",
    maxAge,
  };
}
