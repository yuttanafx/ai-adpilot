// เว็บที่อนุญาตให้ฝังหน้านี้เป็น iframe (ตั้งใน EMBED_ORIGINS คั่นด้วย ,)
// ไม่ตั้ง = ไม่ส่ง header จำกัดการฝัง (ทำงานเหมือนเดิม ใครฝังก็ได้) ตั้งแล้ว = ฝังได้เฉพาะโดเมนที่ระบุ + ตัวเอง
const embed = (process.env.EMBED_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/\/+$/, ""))
  .filter((o) => /^https?:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(o));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["firebase-admin", "@google-cloud/firestore", "@google-cloud/storage"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...(embed.length ? [{ key: "Content-Security-Policy", value: `frame-ancestors 'self' ${embed.join(" ")}` }] : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
