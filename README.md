# AI FutuerX Tool

แดชบอร์ดจัดการโฆษณาด้วย AI (ภาษาไทย) แบบหลายผู้ใช้ สร้างด้วย Next.js (App Router) + TypeScript

## ทำงานอย่างไร

- **หลายผู้ใช้:** แอดมินสร้างบัญชีและรหัสผ่านให้ผู้ใช้ที่หน้า `/admin` (รีเซ็ตรหัส ระงับ ลบ ตั้งเป็นแอดมินได้) ไม่มีหน้าสมัครสมาชิกเอง
- **API key รายบุคคล:** แต่ละผู้ใช้ใส่ API key ของ Gemini / Claude / GPT ของตัวเองในหน้าแดชบอร์ด (ตั้งค่า AI ของฉัน) ค่าใช้จ่ายเป็นของบัญชีผู้ให้บริการของผู้ใช้นั้น
- **ข้อมูลแยกตามผู้ใช้:** คิวอนุมัติ บันทึกการตัดสินใจ สถานะ AI และปุ่มหยุดฉุกเฉิน เก็บในฐานข้อมูลแยกรายคน ใช้ข้ามอุปกรณ์ได้
- **ความปลอดภัย:** รหัสผ่านเก็บเป็นแฮช (scrypt), API key เข้ารหัส AES-256-GCM, คุกกี้เซสชันเซ็นด้วย HMAC (httpOnly), รีเซ็ต/เปลี่ยนรหัสผ่านหรือระงับบัญชีแล้วเซสชันเก่าใช้ไม่ได้ทันที, จำกัดการลองรหัสผ่านและการเรียก AI, ตรวจ Origin กัน CSRF
- แอดมินเห็นเพียงว่าผู้ใช้ตั้ง API key แล้วหรือยัง ไม่เห็นตัว key (แต่ผู้ดูแลเซิร์ฟเวอร์ที่เข้าถึง `AUTH_SECRET` และฐานข้อมูลได้ในทางเทคนิคสามารถถอดรหัสได้ จึงควรเก็บ `AUTH_SECRET` ให้ปลอดภัย)

## เชื่อมต่อบัญชีโฆษณาจริง (Meta / TikTok)

ผู้ใช้แต่ละคนกด **เชื่อมต่อ** ที่ส่วน "เชื่อมต่อบัญชีโฆษณา" ในแดชบอร์ด → ล็อกอิน/อนุญาตที่ Meta หรือ TikTok (OAuth) → เลือกบัญชีโฆษณา แล้วแดชบอร์ดจะดึงข้อมูลจริง 7 วันล่าสุด (เทียบ 7 วันก่อนหน้า) ได้แก่ ค่าโฆษณา ยอดขาย ROAS CPA CTR อัตราปิดการขาย กราฟรายวัน และตารางแคมเปญ

- ขอสิทธิ์อ่านรายงานเท่านั้น (Meta `ads_read`) ไม่แก้ไข/หยุด/สร้างโฆษณา
- token เก็บเข้ารหัส AES-256-GCM แยกรายผู้ใช้ในตาราง `ad_connections` และไม่ถูกส่งกลับไปที่เบราว์เซอร์
- Meta long-lived token อายุราว 60 วัน หมดแล้วต้องกด "เชื่อมต่อใหม่" (ระบบแจ้งเตือนในแดชบอร์ด)
- ถ้าเชื่อมทั้งสองแพลตฟอร์มแต่สกุลเงินต่างกัน จะไม่รวมยอด (ให้เลือกดูทีละแพลตฟอร์ม)
- แคช 2 นาทีต่อบัญชี เพื่อไม่ชน rate limit ของแพลตฟอร์ม

### ตั้งค่าฝั่งผู้ดูแลระบบ (ทำครั้งเดียว)

1. ตั้ง `APP_URL` เป็นโดเมนจริง เช่น `https://your-app.vercel.app` (ในเครื่อง `http://localhost:3000`)
2. **Meta:** สร้างแอปที่ developers.facebook.com → เพิ่มผลิตภัณฑ์ *Facebook Login* และ *Marketing API* → ใส่ `{APP_URL}/api/ads/callback/meta` ใน *Valid OAuth Redirect URIs* → คัดลอก App ID / App Secret ใส่ `META_APP_ID`, `META_APP_SECRET`
   - ถ้าผู้ใช้ไม่ใช่ผู้มีบทบาทในแอป (Admin/Developer/Tester) ต้องผ่าน App Review ขอ **Advanced Access** ของ `ads_read` และสลับแอปเป็น Live
3. **TikTok:** สมัครและสร้างแอปที่ TikTok API for Business (Marketing API) → ใส่ `{APP_URL}/api/ads/callback/tiktok` เป็น Redirect URI → ขอสิทธิ์ Reporting / Ad Account (อ่านอย่างเดียว) → ใส่ `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`
   - แอป TikTok ต้องผ่านการอนุมัติก่อนใช้งานกับบัญชีของผู้ใช้อื่น
4. รีสตาร์ต/Deploy ใหม่ แล้วผู้ใช้กดเชื่อมต่อได้เลย

ถ้าไม่ได้ตั้งค่าอะไร หรือผู้ใช้ยังไม่ได้เชื่อมต่อ แดชบอร์ดจะแสดงข้อมูลตัวอย่างพร้อมคำอธิบายชัดเจน

### ข้อควรรู้

- ตัวเลข "ยอดขาย/ออเดอร์" ดึงจากเหตุการณ์ purchase ที่ติดตั้งไว้ (Meta: `omni_purchase`, TikTok: `complete_payment`) ถ้าไม่ได้ติด Pixel / Events API จะเป็น 0
- ค่าที่ได้อาจต่างจาก Ads Manager เล็กน้อยตามช่วงเวลา (ใช้เขตเวลา Asia/Bangkok) และ attribution window
- Google Ads ยังไม่เชื่อม (ยังแสดงข้อมูลตัวอย่างเฉพาะเมื่อไม่ได้เชื่อมแพลตฟอร์มใดเลย)
- ปุ่มหยุดฉุกเฉินและสวิตช์ AI ยังไม่ได้ควบคุมโฆษณาจริง
- การจำกัดอัตราเป็นแบบในหน่วยความจำ (บน Vercel แต่ละ instance นับแยก) ถ้าต้องการเข้มงวดควรใช้ Redis เช่น Upstash

## รันในเครื่อง

```bash
npm install
cp .env.example .env.local
npm run dev
```

เปิด http://localhost:3000 ถ้าไม่ตั้งค่าอะไร ระบบใช้ที่เก็บข้อมูลจำลองในโฟลเดอร์ `.data/` (ไม่ใช่ Firebase จริง ใช้เฉพาะพัฒนา) และสร้างแอดมินเริ่มต้น `admin` / `admin12345` (ใช้เฉพาะในเครื่องเท่านั้น)

## ขึ้น Vercel

1. **สร้างฐานข้อมูล Firebase:** ที่ [console.firebase.google.com](https://console.firebase.google.com) สร้างโปรเจกต์ → **Build → Firestore Database → Create database** (เลือก **Native mode** และเลือกโลเคชันใกล้ไทย เช่น `asia-southeast1`)
2. **สร้างคีย์ให้เซิร์ฟเวอร์:** **Project settings (ไอคอนเฟือง) → Service accounts → Generate new private key** จะได้ไฟล์ `.json` (เก็บเป็นความลับ ห้ามอัปขึ้น GitHub)
3. **ตั้ง Security Rules** ที่ Firestore → Rules เป็นปิดทั้งหมด เพราะแอปนี้เข้าถึงผ่านเซิร์ฟเวอร์เท่านั้น:
   ```
   rules_version = '2';
   service cloud.firestore { match /databases/{db}/documents { match /{document=**} { allow read, write: if false; } } }
   ```
4. อัปโค้ดขึ้น GitHub แล้ว import ที่ vercel.com (**Add New → Project**)
5. ที่ **Environment Variables** (ติ๊ก Production) เพิ่ม
   - `FIREBASE_SERVICE_ACCOUNT` = เนื้อหาไฟล์ `.json` จากข้อ 2 ทั้งไฟล์
   - `AUTH_SECRET` (สตริงสุ่มยาวๆ จาก `openssl rand -hex 32` ห้ามเปลี่ยนภายหลัง)
   - `ADMIN_USERNAME` และ `ADMIN_PASSWORD` (แอดมินคนแรก อย่างน้อย 8 ตัวอักษร)
6. กด Deploy แล้วเข้าสู่ระบบด้วยแอดมิน → เปิดหน้า **จัดการผู้ใช้** เพื่อสร้างบัญชีให้คนอื่น

คอลเลกชันใน Firestore ถูกสร้างอัตโนมัติเมื่อมีข้อมูลแรก (`users`, `usernames` และข้อมูลย่อยของผู้ใช้: `api_keys`, `ad_connections`, `state`) ถ้าไม่ตั้ง `AUTH_SECRET` หรือ `FIREBASE_SERVICE_ACCOUNT` บน production ระบบจะปิดการเข้าถึงเพื่อความปลอดภัย

**ข้อควรรู้เรื่อง Firestore:** ข้อมูลคิวต่อผู้ใช้จำกัดราว 900 KB ต่อรายการสถานะ (ขีดจำกัด 1 MiB ต่อเอกสารของ Firestore) และระบบล็อกอินยังเป็นของแอปเอง (คุกกี้ + รหัสผ่านแฮช) ไม่ได้ใช้ Firebase Authentication

## โครงสร้าง

- `app/login` หน้าล็อกอิน (มีฉากเคลื่อนไหว `components/LoginScene.tsx`), `app/admin` หน้าแอดมิน, `app/page.tsx` แดชบอร์ด
- `middleware.ts` ตรวจการล็อกอินและ Origin ทุกหน้าและ API
- `lib/db.ts` เชื่อมต่อ Firebase, `lib/store.ts` อ่าน/เขียนข้อมูลผู้ใช้บน Firestore, `lib/memstore.ts` ที่เก็บจำลองสำหรับพัฒนา, `lib/security.ts` แฮชรหัสผ่านและเข้ารหัส key, `lib/ai.ts` เรียก Gemini / Claude / GPT
- `lib/brand.ts` ชื่อแบรนด์ (แก้ที่เดียว), `lib/providers.ts` รายชื่อผู้ให้บริการและโมเดลเริ่มต้น
- `app/api/*` API ทั้งหมด, `app/api/ads/*` OAuth + ดึงรายงาน, `lib/ads/*` ตัวเชื่อม Meta (`meta.ts`) / TikTok (`tiktok.ts`) และตัวรวมข้อมูล (`overview.ts`), `components/AdConnections.tsx` หน้าเชื่อมต่อ
