# AI Usage Journal

บันทึกนี้สรุปว่า **ใช้ AI ช่วยงานส่วนใด** และ **ฉันปรับหรือตัดสินใจเองอย่างไร** หลังแต่ละช่วงงาน เพื่อให้สอดคล้องกับเกณฑ์การส่งงานและการตรวจย้อนหลัง

---

## Session 1: ตั้งโครงโปรเจกต์ Next.js และระบบล็อกอิน

**Prompt (สรุป):** สร้างแอป trainee knowledge assistant มี login, แชต, อัปโหลดไฟล์ และ protected routes

**AI Response (สรุป):** แนะนำ Next.js App Router, NextAuth แบบ credentials, PostgreSQL สำหรับผู้ใช้ และ API แชตที่เรียก Gemini

**My Adjustment:**  
ฉันอ่านเอกสาร Next.js ที่มากับเวอร์ชันที่ติดตั้ง (`node_modules/next/dist/docs/`) ก่อนลงมือ เพราะ API และแนวทางบางอย่างเปลี่ยนจาก Next.js รุ่นที่ใช้กันทั่วไปในบทเรียนเก่า จากนั้นยืนยันโครง App Router และเพิ่ม bcrypt สำหรับรหัสผ่านให้สอดคล้องกับเกณฑ์ความปลอดภัยของโจทย์

---

## Session 2: แก้ปัญหาโมเดล Gemini ไม่พบ (404 / model not found)

**Prompt (สรุป):** แก้ error ว่าโมเดล `gemini-1.5-flash` ไม่รองรับกับ API เวอร์ชันที่ใช้

**AI Response (สรุป):** ย้ายชื่อโมเดลไปที่ environment และเลือกโมเดลที่ยังเปิดใช้กับ key ได้

**My Adjustment:**  
ฉันตั้งค่าเริ่มต้นเป็น `gemini-2.5-flash` เพิ่ม `GEMINI_MODEL` ให้ override ได้ และเขียนข้อความแนะนำเมื่อเจอ 404 ว่าอาจต้องลอง `gemini-2.0-flash` เพื่อลดเวลา debug รอบถัดไป

---

## Session 3: แยกโค้ดแชตเป็นโมดูลและคอมโพเนนต์

**Prompt (สรุป):** refactor แยกไฟล์แชตให้นำกลับมาใช้ใหม่ได้

**AI Response (สรุป):** แยก route, service, validation, security, UI

**My Adjustment:**  
ฉันย้าย logic ไป `src/lib/chat/*`, `src/lib/security/rate-limit.ts` และแยก UI เป็น `ChatComposer`, `MessageList`, `MarkdownMessage`, `TokenUsageBadge`, `ChatSidebar` ส่วน state การสตรีมที่ผูกกับ SSE ยังอยู่ใน `chat-client.tsx` เพราะเป็นจุดที่ต้อง interactive แน่นอน

---

## Session 4: รองรับอัปโหลด TXT/PDF เป็นบริบทแชต

**Prompt (สรุป):** ให้แชทกับเอกสารที่แนบ PDF/TXT

**AI Response (สรุป):** validate ชนิด/ขนาด, sanitize ชื่อไฟล์, TXT อ่านเป็นข้อความ, PDF ส่งเป็น inline data

**My Adjustment:**  
ฉันทำ validation ฝั่ง API ให้เข้มขึ้น จำกัดขนาดและความยาว context สำหรับ TXT และให้ PDF เป็น base64 inline ตามข้อจำกัดของ pipeline ในขณะนั้น โดยยังไม่เก็บไฟล์ถาวรใน storage ของเซิร์ฟเวอร์

---

## Session 5: แชตใหม่และประวัติการสนทนา

**Prompt (สรุป):** เพิ่ม new chat และ history

**AI Response (สรุป):** เก็บหลายบทสนทนาและ persist ใน localStorage

**My Adjustment:**  
ฉันเพิ่ม `ChatHistoryPanel`, ปุ่ม New Chat, ชื่อบทสนทนาจากข้อความแรกของผู้ใช้ และจำกัดจำนวนรายการเพื่อไม่ให้ localStorage โตไม่มีที่สิ้นสุด

---

## Session 6: RAG กับ Chroma สำหรับ TXT

**Prompt (สรุป):** ต้องการใช้ Vector DB จริงและเชื่อมกับโค้ด

**AI Response (สรุป):** แนะนำ chunking, embedding API, เก็บ/ค้นใน Chroma และจุดเชื่อมใน API แชต

**My Adjustment:**  
ฉันยืนยันว่าใช้ Gemini embedding (`text-embedding-004`) และ Chroma ผ่าน `CHROMA_URL` สำหรับ TXT เท่านั้นในขั้นแรก ส่วน PDF ยังคงใช้เส้นทาง inline เดิมเพื่อไม่บังคับ PDF text extraction ในทีเดียว และเพิ่ม `serverExternalPackages` ใน Next config เพื่อให้ build ผ่านกับแพ็กเกจ chromadb

---

## Session 7: Unit tests (Vitest) และ coverage

**Prompt (สรุป):** unit test ทำอย่างไร และให้เข้าใกล้เกณฑ์ coverage ของโจทย์

**AI Response (สรุป):** ตั้ง Vitest, เขียนเทสต์ตัวอย่างกับฟังก์ชันบริสุทธิ์, ตั้ง coverage thresholds

**My Adjustment:**  
ฉันเลือกเทสฟังก์ชันที่ทดสอบง่ายและสำคัญ เช่น validation, chunk text, rate limit, และฟังก์ชันคำนวณโทเคนแบบ fallback บน Gemini module แล้วกำหนดขอบเขต coverage ใน `vitest.config.ts` ให้สะท้อนไฟล์ที่ตั้งใจรับประกันคุณภาพก่อน แทนการแตะทุกไฟล์ใน repo ในครั้งเดียว

---

## Session 8: เอกสารภาษาไทย (README, DECISIONS, AI_JOURNAL)

**Prompt (สรุป):** เขียน README, DECISIONS, AI_JOURNAL เป็นภาษาไทยใหม่ทั้งหมด

**AI Response (สรุป):** ร่างโครงเอกสารตามเกณฑ์ส่งงานและสถานะโปรเจกต์ล่าสุด

**My Adjustment:**  
ฉันตรวจทานให้สอดคล้องกับพอร์ต Docker (`3001` บน host), สถานะ RAG TXT/PDF, คำสั่งทดสอบ, และข้อจำกัดที่ยังเหลืออยู่ เพื่อให้ผู้ตรวจอ่านแล้วเข้าใจภาพรวมได้โดยไม่ขัดกับโค้ดจริง
