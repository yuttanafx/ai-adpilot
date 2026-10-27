import { AppError } from "@/lib/db";
import { completeUpload, deleteMedia, openForRead, saveLocalUpload, MAX_VIDEO_BYTES } from "@/lib/media";
import { json, withUser } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

export const runtime = "nodejs";

// ดู/เล่นไฟล์ (เฉพาะเจ้าของ)
export const GET = withUser<Ctx>(async (req, user, ctx) => {
  const { id } = await ctx.params;
  return openForRead(user.id, id, req.headers.get("range"));
});

// อัปโหลดไฟล์ตอนพัฒนาในเครื่อง (บน production ไฟล์ถูกส่งตรงไป Firebase Storage)
export const PUT = withUser<Ctx>(async (req, user, ctx) => {
  const { id } = await ctx.params;
  const len = Number(req.headers.get("content-length"));
  if (len > MAX_VIDEO_BYTES) throw new AppError("ไฟล์ใหญ่เกินกำหนด", 413);
  await saveLocalUpload(user.id, id, await req.arrayBuffer());
  return json({ ok: true });
});

// ยืนยันว่าอัปโหลดเสร็จ
export const POST = withUser<Ctx>(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  return json({ media: await completeUpload(user.id, id) });
});

export const DELETE = withUser<Ctx>(async (_req, user, ctx) => {
  const { id } = await ctx.params;
  await deleteMedia(user.id, id);
  return json({ ok: true });
});
