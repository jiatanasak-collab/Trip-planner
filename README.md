# สมุดแผนเที่ยว (Trip Planner + Travel Journal)

เว็บแอปวางแผนเที่ยวรายวัน มีที่พัก งบประมาณ เช็กลิสต์ แผนที่การเดินทาง และ AI ช่วยจัดแผน
ข้อมูลทั้งหมดเก็บในเบราว์เซอร์ของผู้ใช้ (IndexedDB) จึงใช้งานได้ทันทีโดยไม่ต้องมีฐานข้อมูล

สร้างใหม่จากต้นแบบ `reference/trip-planner-reference.html` โดยฟีเจอร์ หน้าตา และพฤติกรรมเหมือนเดิม

## เริ่มใช้งาน

ต้องมี [Node.js](https://nodejs.org) เวอร์ชัน 20 ขึ้นไป

```bash
npm install
npm run dev
```

แล้วเปิด http://localhost:5173

ไม่ต้องมีคีย์ AI ก็ใช้ได้ครบทุกอย่าง ยกเว้นปุ่ม AI ซึ่งจะถูกซ่อนไว้ (หน้านำเข้าแผนจะขึ้นว่า "AI ยังไม่ได้ตั้งค่า")

## เปิดใช้ AI (ไม่บังคับ)

ปุ่ม AI ได้แก่ "ให้ AI จัดให้" (อ่านแผนจากข้อความหรือรูป) "ให้ AI เขียนหมายเหตุ" และ "หาพิกัดที่ขาด"

1. สร้างคีย์ที่ [console.anthropic.com](https://console.anthropic.com) (เสียค่าใช้จ่ายตามการใช้งาน)
2. คัดลอก `.env.example` เป็น `.env` แล้วใส่คีย์

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. รัน `npm run dev` ใหม่ ข้อความในเทอร์มินัลจะขึ้นว่า `AI: เปิดใช้งาน`

คีย์อยู่ฝั่งเซิร์ฟเวอร์เท่านั้น เบราว์เซอร์เรียก AI ผ่าน `/api/ai` ของเราเอง ไม่เห็นคีย์
โมเดลที่ใช้คือ `claude-sonnet-5-5` (ตั้งไว้ใน `server/app.ts`) รองรับการส่งรูปภาพ และเปิด server-side fallback ไว้ ถ้าโมเดลปฏิเสธคำขอ API จะลองโมเดลสำรองให้อัตโนมัติ

## คำสั่ง

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | เปิดแอปสำหรับพัฒนา (หน้าเว็บที่พอร์ต 5173 + API ที่พอร์ต 8787) |
| `npm test` | รัน unit test |
| `npm run typecheck` | ตรวจ TypeScript |
| `npm run build` | build หน้าเว็บไปที่ `dist/` |
| `npm start` | รันแอปที่ build แล้ว (หน้าเว็บ + API) บน Node ตัวเดียว ที่พอร์ต `PORT` (ค่าเริ่มต้น 3000) |

## Deploy

### Vercel
1. push โค้ดขึ้น GitHub (repo นี้)
2. ที่ [vercel.com](https://vercel.com) เลือก **Add New → Project** แล้วเลือก repo นี้ Vercel จะรู้เองว่าเป็น Vite
3. ถ้าจะใช้ AI ให้เพิ่ม Environment Variable ชื่อ `ANTHROPIC_API_KEY`
4. กด Deploy

ไฟล์ `api/[...route].ts` ทำให้ `/api/*` บน Vercel ใช้ server ตัวเดียวกับตอน dev
(ยังไม่ได้ทดสอบ deploy จริงบน Vercel ถ้ามีปัญหาให้ดู log ของ Function ใน Vercel)

### เซิร์ฟเวอร์ Node ทั่วไป (Render, Railway, Fly.io, VPS)
```bash
npm install
npm run build
ANTHROPIC_API_KEY=sk-ant-... PORT=3000 npm start
```

## ข้อมูลและการย้ายข้อมูล

- ข้อมูลเก็บใน IndexedDB ของเบราว์เซอร์ แยกตามเครื่องและเบราว์เซอร์ ถ้าล้างข้อมูลเว็บไซต์ ข้อมูลจะหาย
- **ส่งออก JSON** (ในหน้าทริป) ดาวน์โหลดทริปเดียว
- **สำรองข้อมูลทั้งหมด** (หน้าแรก) ดาวน์โหลดทุกทริปรวมประเทศที่ติ๊กว่าเคยไป
- **นำเข้าไฟล์ JSON** (หน้าแรก) รับไฟล์จากสองปุ่มข้างบน และไฟล์ JSON ทริปจากต้นแบบ ถ้ามีทริปเดิมอยู่แล้ว เลือกได้ว่าจะแทนที่หรือเพิ่มเป็นสำเนา

## โครงสร้างโปรเจกต์

```
src/
  domain/      logic ล้วน ไม่มี React (ย้ายจากต้นแบบ) — ทดสอบด้วย Vitest
    types.ts       โครงสร้างข้อมูล Trip / Day / Item / Stay / Journal
    trip.ts        สร้างทริป, sanitizeTrip, จัดวันตามช่วงวันที่, ที่พัก, งบประมาณ, นำเข้าแผน
    basicParse.ts  แปลงแผนจากข้อความแบบไม่ใช้ AI
    icons.ts       ไอคอน 31 แบบ + ICON_RULES / CAT_ALLOWED / itemIcon
    geo.ts         parseLL / cleanLL
    backup.ts      อ่าน/เขียนไฟล์ JSON
  store/       TripStore (interface) + DexieTripStore (IndexedDB)
  ai/          prompt (AI_INSTR, NOTE_RULES) และตัวเรียก /api/ai
  map/         แผนที่โลก/ประเทศ/ทริป ด้วย d3-geo + world-atlas
  features/    หน้าจอ: home, trip (6 แท็บ), forms, import
  styles/      CSS จากต้นแบบ (app.css) + ส่วนเพิ่ม (extra.css)
server/        Hono API: /api/status, /api/ai
api/           ตัวเชื่อมสำหรับ Vercel
tests/         unit test
reference/     ต้นแบบเดิม
```

### เปลี่ยนไปเก็บข้อมูลบน backend
เขียนคลาสใหม่ที่ implement `TripStore` (`src/store/TripStore.ts`) แล้วเปลี่ยนบรรทัดเดียวใน `src/main.tsx`
หน้าจอทั้งหมดใช้ข้อมูลผ่าน interface นี้

## ต่างจากต้นแบบ

- เก็บข้อมูลในเบราว์เซอร์แทนบัญชี Claude และเรียก AI ผ่าน backend ของเราเอง
- เพิ่มส่งออก/นำเข้าไฟล์ JSON และสำรองข้อมูลทั้งหมด
- แปลงแบบพื้นฐานอ่านราคาที่มีสัญลักษณ์นำหน้าได้ เช่น `฿200`, `¥1,500`
- ย่อรูปให้เหลือด้านยาวสุด 1600px ก่อนส่งให้ AI เพื่อให้เร็วขึ้นและประหยัดขึ้น
- ระหว่างรอ AI ถ้าผู้ใช้แก้หมายเหตุหรือพิกัดเอง จะไม่ถูกเขียนทับ
- บนมือถือ ฟอร์มกิจกรรมและที่พักเรียงเป็นคอลัมน์เดียว
