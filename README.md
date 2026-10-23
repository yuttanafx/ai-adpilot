# AI FutuerX Tool

แดชบอร์ดจัดการโฆษณาด้วย AI (ภาษาไทย) สร้างด้วย Next.js (App Router) + TypeScript

## ใช้งานได้จริงตอนนี้

- สร้างคอนเทนต์โฆษณาด้วย AI (Meta / Google / TikTok) ส่งเข้าคิวอนุมัติ แก้ไข อนุมัติ ไม่อนุมัติ ได้
- บันทึกการตัดสินใจ, คิวอนุมัติ, สถานะ AI และปุ่มหยุดฉุกเฉิน จำค่าไว้ในเบราว์เซอร์ (localStorage)
- ล็อกอินด้วยรหัสผ่าน (`APP_PASSWORD`) ป้องกันทั้งหน้าเว็บและ API
- จำกัดอัตราเรียก API (rate limit เบื้องต้น)

## ยังเป็นข้อมูลตัวอย่าง

- ตัวเลข KPI กราฟ ตารางแคมเปญ ครีเอทีฟ และการแจ้งเตือน ใน `lib/data.ts` ยังเป็น mock
  ต้องเชื่อม Meta Marketing API / Google Ads API / TikTok Marketing API (ต้องมีบัญชีนักพัฒนาและ token ของคุณเอง) จึงจะเป็นข้อมูลจริง
- ปุ่มหยุดฉุกเฉินและสวิตช์ AI ยังไม่ได้ควบคุมระบบโฆษณาจริง เมื่อเชื่อม API แล้วต้องเก็บสถานะฝั่งเซิร์ฟเวอร์และให้ตัวปรับงบเช็กก่อนทำทุกครั้ง
- คิวอนุมัติ/บันทึก ผูกกับเบราว์เซอร์เครื่องนั้น ยังไม่ซิงก์ข้ามเครื่อง (ควรย้ายไปฐานข้อมูล เช่น Postgres/Supabase)

## รันในเครื่อง

```bash
npm install
cp .env.example .env.local   # ใส่ GEMINI_API_KEY หรือ ANTHROPIC_API_KEY (และ APP_PASSWORD ถ้าต้องการทดสอบล็อกอิน)
npm run dev
```

เปิด http://localhost:3000 (ตอนรันในเครื่องถ้าไม่ตั้ง `APP_PASSWORD` จะเข้าได้เลย)

## ขึ้น Vercel

1. อัปโค้ดขึ้น GitHub
2. ที่ vercel.com เลือก **Add New → Project** แล้ว import repo นี้
3. ที่ **Environment Variables** เพิ่ม
   - `GEMINI_API_KEY` หรือ `ANTHROPIC_API_KEY` (ต้องมีอย่างน้อย 1 ตัว)
   - `APP_PASSWORD` (จำเป็น ถ้าไม่ตั้ง ระบบจะปิดการเข้าถึงบน production)
   - `AUTH_SECRET` (แนะนำ สตริงสุ่มยาวๆ)
4. กด Deploy

## โครงสร้าง

- `app/page.tsx` หน้าแดชบอร์ด, `app/login/page.tsx` หน้าล็อกอิน
- `middleware.ts` ตรวจการล็อกอินทุกหน้าและ API
- `components/` ส่วนติดต่อผู้ใช้ (`CreativeGenerator.tsx` ฟอร์มสร้างคอนเทนต์)
- `lib/brand.ts` ชื่อแบรนด์ (แก้ชื่อที่นี่ที่เดียว)
- `lib/data.ts` ข้อมูลตัวอย่าง (mock)
- `app/api/generate-creatives/route.ts` ให้ AI เขียนคอนเทนต์โฆษณา
