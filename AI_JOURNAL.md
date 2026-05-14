# AI Usage Journal

## Session 1: การตั้งค่าโปรเจกต์ Next.js
**Prompt:** "Create a trainee knowledge assistant with login, chat, file upload, and protected routes."

**AI Response:**  
AI แนะนำโครงสร้างโปรเจกต์แบบ Next.js App Router พร้อมหน้า `/chat` ที่มีการป้องกันการเข้าถึง ใช้ NextAuth แบบ credentials login จัดเก็บผู้ใช้ด้วย PostgreSQL และมี Chat API ที่เชื่อมกับ Gemini

**My Adjustment:**  
ฉันตรวจสอบเอกสารของ Next.js 16 ที่ติดตั้งอยู่ใน `node_modules/next/dist/docs/` ก่อนเริ่มแก้ไข เพราะโปรเจกต์นี้ใช้ Next.js เวอร์ชันใหม่ที่มีรูปแบบการใช้งานบางส่วนเปลี่ยนไป จากนั้นยังคงใช้โครงสร้าง App Router ตามที่ AI แนะนำ และเพิ่มการเข้ารหัสรหัสผ่านด้วย bcrypt เพื่อให้การจัดการ credentials มีความปลอดภัยมากขึ้น

---

## Session 2: แก้ปัญหา Gemini model error
**Prompt:** "The app returns models/gemini-1.5-flash is not found for API version v1beta. Fix it."

**AI Response:**  
AI วิเคราะห์ว่าชื่อโมเดลถูกกำหนดแบบ hardcoded และโมเดลดังกล่าวอาจไม่รองรับกับ API หรือ API key ปัจจุบัน จึงแนะนำให้ย้ายชื่อโมเดลไปไว้ใน environment configuration และใช้ Gemini Flash รุ่นที่ยังรองรับอยู่

**My Adjustment:**  
ฉันเปลี่ยนค่าโมเดลเริ่มต้นเป็น `gemini-2.5-flash` เพิ่มตัวแปร `GEMINI_MODEL` เพื่อให้สามารถ override ได้ และเพิ่มข้อความแจ้งข้อผิดพลาดที่แนะนำให้ผู้ใช้เปลี่ยนไปใช้ `gemini-2.0-flash` หาก API key ของตนยังไม่รองรับโมเดลเริ่มต้น

---

## Session 3: Refactor โค้ดระบบแชต
**Prompt:** "Refactor the chat code and split components so each file can be reused."

**AI Response:**  
AI แนะนำให้แยก logic ของ route, service, validation, security helper และ UI component ออกจากกัน แทนที่จะรวมทุกอย่างไว้ในไฟล์ chat client ขนาดใหญ่ไฟล์เดียว

**My Adjustment:**  
ฉันแยกโค้ดออกเป็น `src/lib/chat/*`, `src/lib/security/rate-limit.ts` และสร้าง reusable component เช่น `ChatComposer`, `MessageList`, `MarkdownMessage`, `TokenUsageBadge` และ `ChatSidebar` ส่วน state ที่เกี่ยวกับ streaming ยังคงเก็บไว้ใน `chat-client.tsx` เพราะเป็นพฤติกรรมที่ต้องทำงานฝั่ง client แบบ interactive

---

## Session 4: เพิ่มระบบอัปโหลดไฟล์สำหรับใช้เป็น context ในแชต
**Prompt:** "Support PDF/TXT upload for chat with document context."

**AI Response:**  
AI แนะนำให้ตรวจสอบประเภทและขนาดไฟล์ sanitize ชื่อไฟล์ อ่าน TXT เป็นข้อความ และส่ง PDF ไปยัง Gemini ในรูปแบบ inline data

**My Adjustment:**  
ฉันพัฒนาระบบจัดการ TXT/PDF ฝั่ง browser พร้อมกำหนดขนาดไฟล์สูงสุดที่ 10MB ไฟล์ TXT จะถูกตัดให้เหลือขนาด context ที่ปลอดภัย ส่วน PDF จะถูกแปลงเป็น base64 และส่งไปยัง Gemini ในรูปแบบ inline PDF data โดยยังไม่ได้จัดเก็บไฟล์ถาวร เพราะฟีเจอร์ปัจจุบันต้องการเพียง context ระหว่าง request เท่านั้น

---

## Session 5: เพิ่มระบบสร้างแชตใหม่และประวัติการสนทนา
**Prompt:** "Add new chat and chat history."

**AI Response:**  
AI แนะนำให้เก็บหลาย conversation ใน local state และบันทึกข้อมูลลง local storage เพื่อให้ผู้ใช้สามารถสลับดูแชตก่อนหน้าได้

**My Adjustment:**  
ฉันเพิ่ม `ChatHistoryPanel`, ปุ่ม `New Chat`, state สำหรับ active conversation และระบบสร้างชื่อ conversation อัตโนมัติจากข้อความแรกของผู้ใช้ รวมถึงบันทึกข้อมูลลง `localStorage` โดยจำกัดประวัติไว้สูงสุด 20 conversations และ 40 messages ต่อ conversation เพื่อป้องกันการใช้พื้นที่ browser storage มากเกินไป

---

## Session 6: เขียนเอกสารโปรเจกต์
**Prompt:** "Write README, AI_JOURNAL.md, and DECISIONS.md for grading."

**AI Response:**  
AI แนะนำให้เขียนเอกสารที่อธิบายวิธีติดตั้ง เทคโนโลยีที่ใช้ ฟีเจอร์ที่ทำเสร็จแล้ว ปัญหาที่ยังมีอยู่ การใช้ AI และเหตุผลด้านสถาปัตยกรรมของระบบอย่างชัดเจน

**My Adjustment:**  
ฉันเขียน README ตามหัวข้อที่ assignment กำหนด และระบุอย่างตรงไปตรงมาว่ายังมีบางส่วนที่ยังไม่เสร็จ เช่น RAG และระบบทดสอบ (tests) นอกจากนี้ยังอธิบายข้อจำกัดของระบบจัดเก็บไฟล์ในปัจจุบัน และเสนอแนวทางสำหรับ production โดยใช้ Cloudflare R2 ร่วมกับ PostgreSQL metadata เพื่อสร้างระบบอัปโหลดไฟล์ที่เหมาะสมมากขึ้น