# Knowledge Assistant

เว็บแอป **ผู้ช่วยความรู้แบบมีการยืนยันตัวตน** สำหรับสนทนากับ AI พร้อมแนบเอกสาร **TXT หรือ PDF** เพื่อใช้เป็นบริบทคำตอบ รองรับการสตรีมคำตอบ แสดง Markdown นับโทเคนรายข้อความและรวมต่อเซสชัน มีหน้าอัปโหลด ประวัติแชตในเครื่อง และ RAG ผ่าน **ChromaDB** สำหรับไฟล์ TXT เมื่อตั้งค่า `CHROMA_URL`

โปรเจกต์นี้เริ่มจาก **Create Next App** (boilerplate Next.js) แล้วพัฒนาต่อเอง — รายละเอียดการใช้ AI อยู่ใน `AI_JOURNAL.md` และเหตุผลเชิงสถาปัตยกรรมใน `DECISIONS.md`

---

## Tech Stack

- **Frontend / Backend:** Next.js 16 (App Router), React 19, TypeScript, Route Handlers (`src/app/api/*`)
- **การยืนยันตัวตน:** NextAuth (Credentials), รหัสผ่านผ่าน **bcrypt**
- **ฐานข้อมูล:** PostgreSQL (เก็บบัญชีผู้ใช้)
- **Vector DB:** ChromaDB (Docker) — ใช้กับ pipeline **chunk → embedding (Gemini) → retrieval** สำหรับ **TXT** เมื่อมี `CHROMA_URL`
- **AI:** Google Gemini (รองรับ fallback ผู้ให้บริการอื่นผ่าน `src/lib/chat/ai.ts` เมื่อตั้งค่า key)
- **การรัน:** Docker Compose (`docker compose up`)

---

## Setup & Run

### รันด้วย Docker (คำสั่งเดียวตามโจทย์)

```bash
docker compose up --build
```

จาก `docker-compose.yml` แอปถูก map ออกมาที่พอร์ต **3001** บนเครื่อง host (ภายใน container ยังเป็น port 3000):

```txt
http://localhost:3001
```

### พัฒนาในเครื่อง (ไม่ผ่าน Docker สำหรับแอป)

```bash
npm install
npm run dev
```

ค่าเริ่มต้นของ `next dev` มักเป็น `http://localhost:3000` — ตั้ง `NEXTAUTH_URL` ให้ตรงกับ URL ที่ใช้จริง

### ตัวแปรสภาพแวดล้อมที่จำเป็น

คัดลอกจาก `.env.example` แล้วปรับค่า:

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_API_KEYS=
GEMINI_MODEL=gemini-2.5-flash
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3001
DATABASE_URL=postgresql://admin:password@db:5432/knowledge_assistant
CHROMA_URL=http://chromadb:8000
```

- รันแอป **ใน Docker:** ใช้ `CHROMA_URL=http://chromadb:8000` และ `DATABASE_URL` ชี้ไปที่ service `db` ตามตัวอย่าง
- รัน **`npm run dev` บนเครื่อง:** ถ้า Chroma รันที่เครื่องเดียวกัน ใช้ `CHROMA_URL=http://localhost:8000`

หากโมเดล `gemini-2.5-flash` ใช้กับ key ของคุณไม่ได้ ให้ตั้งเช่น:

```env
GEMINI_MODEL=gemini-2.0-flash
```

### การทดสอบ (Unit test)

```bash
npm run test
npm run test:coverage
```

รายงาน coverage และเกณฑ์ขั้นต่ำกำหนดใน `vitest.config.ts` (ครอบคลุมโมดูล `src/lib` ชุดที่ระบุ ไม่ใช่ทุกไฟล์ใน repo ทั้งหมด)

---

## Features Done

- [x] หน้า Login + เส้นทางที่ต้องล็อกอิน (เช่น `/chat`, `/upload`)
- [x] ลงทะเบียนผู้ใช้ + เข้ารหัสรหัสผ่านด้วย bcrypt
- [x] อัปโหลดไฟล์ **PDF / TXT** (มีหน้า `/upload` และแนบไฟล์ในหน้าแชตได้)
- [x] ตรวจชนิดไฟล์ ขนาด และ sanitize ชื่อไฟล์
- [x] แชทกับ AI + จัดการ error และ timeout
- [x] แชทโดยอ้างอิงเอกสารที่แนบ (TXT: RAG ผ่าน Chroma เมื่อตั้ง `CHROMA_URL`; PDF: ส่งแบบ inline ไป Gemini)
- [x] แสดงการใช้โทเคน **ต่อข้อความ** และ **รวมต่อเซสชันแชต**
- [x] สตรีมคำตอบ (SSE)
- [x] แสดง Markdown ในข้อความผู้ช่วย
- [x] แนว citation ผ่าน prompt ให้อ้าง `[ชื่อไฟล์]`
- [x] แชตใหม่ + ประวัติการสนทนา (เก็บใน `localStorage`)
- [x] Rate limiting ฝั่ง API
- [x] หมุน API key Gemini ผ่าน `GEMINI_API_KEYS`
- [x] Docker Compose + healthcheck
- [x] RAG + Vector DB สำหรับ **TXT** (chunk, embedding, retrieval)
- [x] Unit tests (Vitest + coverage ตาม config)

---

## Architecture

- **หน้าเว็บ:** App Router — หน้าที่ต้องล็อกอินตรวจ session ฝั่งเซิร์ฟเวอร์ ส่วน UI แชตเป็น Client Component
- **`src/app/chat/`** — ประสบการณ์แชต แนบไฟล์ รับสตรีม SSE
- **`src/app/upload/`** — หน้าอัปโหลดเอกสาร
- **`src/app/api/chat/route.ts`** — ตรวจสอบสิทธิ์ จำกัดความถี่ ตรวจ payload แล้วสตรีมคำตอบ
- **`src/lib/auth.ts`**, **`src/lib/users.ts`** — NextAuth และข้อมูลผู้ใช้ใน PostgreSQL
- **`src/lib/chat/`** — validation, Gemini, ชั้นบริการ AI รวม
- **`src/lib/rag/`** — แบ่ง chunk, embedding, เชื่อม Chroma, ประกอบ context สำหรับ TXT
- **`src/components/chat/`** — คอมโพเนนต์ UI แชต

ไฟล์ที่อัปโหลด **ยังไม่ถูกเก็บถาวรในเซิร์ฟเวอร์** — ใช้เป็นบริบทต่อคำขอแชตเป็นหลัก

---

## Known Issues

- **RAG:** ทำเต็มรูปแบบกับ **TXT** เมื่อมี Chroma; **PDF** ยังไม่ได้แยกข้อความมา chunk/embed ลง vector DB
- **ประวัติแชต:** อยู่ใน `localStorage` ต่อเครื่อง/ต่อบราวเซอร์ ไม่ sync ผ่านบัญชีบนฐานข้อมูล
- **Rate limit:** เก็บในหน่วยความจำของโปรเซส — รีสตาร์ทแล้วรีเซ็ต และไม่แชร์ระหว่างหลาย instance
- **Coverage:** เกณฑ์ใน `vitest.config.ts` จำกัดชุดไฟล์ที่วัด — ไม่ได้หมายถึง coverage ทั้ง monorepo ทุกไฟล์
