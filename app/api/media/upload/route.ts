import { AppError } from "@/lib/db";
import { createUpload } from "@/lib/media";
import { json, readJson, withUser } from "@/lib/http";
import { rateLimit } from "@/lib/rateLimit";

// ขั้นที่ 1 ของการแนบไฟล์: ขอที่อัปโหลด (เบราว์เซอร์ส่งไฟล์ไปที่ uploadUrl เอง แล้วเรียก POST /api/media/{id} เพื่อยืนยัน)
export const POST = withUser(async (req, user) => {
  const rl = rateLimit("mediaup:" + user.id, 30, 60_000);
  if (!rl.ok) throw new AppError(`อัปโหลดบ่อยเกินไป กรุณารอ ${rl.retryAfter} วินาที`, 429);
  const b = await readJson(req);
  return json(await createUpload(user.id, { kind: b.kind, mime: b.mime, size: Number(b.size), name: b.name }));
});
