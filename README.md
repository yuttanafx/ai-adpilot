# AI Ad Pilot

แดชบอร์ดจัดการโฆษณาด้วย AI สร้างด้วย Next.js (App Router) + TypeScript

## รันในเครื่อง

```bash
npm install
cp .env.example .env.local   # ใส่ ANTHROPIC_API_KEY
npm run dev
```

เปิด http://localhost:3000

## ขึ้น Vercel

1. อัปโค้ดขึ้น GitHub
2. ที่ vercel.com เลือก **Add New → Project** แล้ว import repo นี้ (Vercel ตรวจเจอ Next.js เอง ไม่ต้องตั้งค่า build)
3. ที่ **Environment Variables** เพิ่ม `ANTHROPIC_API_KEY`
4. กด Deploy

หรือใช้ CLI: `npx vercel` แล้ว `npx vercel --prod`

## โครงสร้าง

- `app/page.tsx` หน้าแดชบอร์ด
- `components/Dashboard.tsx`, `components/TrendChart.tsx` ส่วนติดต่อผู้ใช้
- `lib/data.ts` ข้อมูลตัวอย่าง (mock) ให้แทนด้วยข้อมูลจริงจาก Meta / Google / TikTok API
- `app/api/generate-creatives/route.ts` ให้ AI คิดคอนเทนต์โฆษณาเป็นชุดข้อมูล JSON

## ทดสอบ API สร้างคอนเทนต์

```bash
curl -X POST http://localhost:3000/api/generate-creatives \
  -H "Content-Type: application/json" \
  -d '{"product":"ครีมกันแดด SPF50","audience":"ผู้หญิง 25-40 ทำงานออฟฟิศ","platform":"meta","offer":"ลด 20% สัปดาห์นี้","count":3}'
```

## สิ่งที่ยังต้องทำก่อนใช้งานจริง

- เชื่อม API โฆษณาจริงแทนข้อมูลใน `lib/data.ts`
- เพิ่มระบบล็อกอิน (ตอนนี้ใครมีลิงก์ก็เปิดได้ และ API route เรียกได้ ควรเพิ่ม auth และ rate limit ก่อนเปิดสาธารณะ)
- เก็บ Decision Log และคิวอนุมัติลงฐานข้อมูล (ตอนนี้เป็นสถานะในหน้าเว็บ รีเฟรชแล้วหาย)
