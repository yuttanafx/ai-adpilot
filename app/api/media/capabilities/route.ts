import { getDb } from "@/lib/db";
import { keyProviders } from "@/lib/store";
import { json, withUser } from "@/lib/http";
import { IMAGE_PROVIDERS, VIDEO_PROVIDERS, type Provider } from "@/lib/providers";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, storageType } from "@/lib/media";
import type { MediaCaps } from "@/lib/mediaTypes";

// บอกหน้าเว็บว่าผู้ใช้คนนี้ใช้ฟีเจอร์รูป/วิดีโอได้อะไรบ้าง (ขึ้นกับ API key ที่ใส่ไว้ และที่เก็บไฟล์)
export const GET = withUser(async (_req, user) => {
  const have = new Set((await keyProviders(await getDb(), user.id)).map((k) => k.provider as Provider));
  const caps: MediaCaps = {
    storage: await storageType(),
    image: IMAGE_PROVIDERS.filter((p) => have.has(p)),
    video: VIDEO_PROVIDERS.filter((p) => have.has(p)),
    imageSupported: IMAGE_PROVIDERS,
    videoSupported: VIDEO_PROVIDERS,
    maxImageMB: Math.round(MAX_IMAGE_BYTES / 1048576),
    maxVideoMB: Math.round(MAX_VIDEO_BYTES / 1048576),
  };
  return json(caps);
});
