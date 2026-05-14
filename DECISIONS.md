# Architecture Decisions

## Decision 1: เลือกใช้ Next.js App Router และ Route Handlers

### Context
โปรเจกต์นี้ต้องมีหน้าที่ต้องยืนยันตัวตนผู้ใช้ (authenticated pages), API endpoints, การเข้าถึง secrets ฝั่ง server และระบบแชตแบบ interactive โดย framework ที่ใช้งานคือ Next.js 16 และโจทย์ของโปรเจกต์ระบุชัดเจนว่าไม่ใช่ API รูปแบบเก่าของ Next.js อีกต่อไป เนื่องจากฟีเจอร์แชตต้องรองรับ browser state, streaming responses และการป้องกันการทำงานฝั่ง server แอปจึงต้องแยกส่วนของ client-side UI และ server-side API logic ออกจากกันอย่างชัดเจน นอกจากนี้หน้า `/chat` ยังต้องป้องกันผู้ใช้ที่ยังไม่ได้เข้าสู่ระบบก่อนเข้าถึงตัวแอปด้วย

### Alternatives Considered
ตัวเลือกหนึ่งคือสร้าง Express API แยกจาก React frontend อีกตัวเลือกคือใช้ Pages Router API routes แบบเก่า และอีกแนวทางคือเก็บ logic ทั้งหมดไว้ใน client components แล้วเรียก Gemini จาก browser โดยตรง

### Why Next.js App Router
App Router ช่วยให้ระบบ routing, protected server pages และ API Route Handlers อยู่ในโปรเจกต์เดียวกัน Route Handlers ยังรองรับการ stream แบบ Server-Sent Events ได้ พร้อมทั้งเก็บ Gemini API keys ไว้ฝั่ง server อย่างปลอดภัย นอกจากนี้ Server Components ยังเหมาะกับการตรวจสอบ session และ redirect ผู้ใช้ ขณะที่ Client Components รับผิดชอบ state ของข้อความ การอัปโหลดไฟล์ และการอัปเดต UI แบบ streaming

### Trade-offs
แนวทางนี้ต้องระวังเรื่องขอบเขตระหว่าง server/client มากขึ้น Components ที่ใช้ `localStorage`, state, file input หรือ event handlers จำเป็นต้องเป็น client components ขณะที่ authentication และ secrets ต้องอยู่ฝั่ง server แม้จะง่ายกว่าการแยก backend ออกมาต่างหาก แต่หาก API มีขนาดใหญ่ขึ้นมากในอนาคต โครงสร้างนี้อาจแยกส่วนได้ไม่ชัดเจนเท่าระบบ backend โดยเฉพาะ

---

## Decision 2: เก็บประวัติแชตด้วย localStorage ก่อน

### Context
เกณฑ์การประเมินต้องการฟีเจอร์ conversation history แต่โปรเจกต์ยังไม่มี schema สำหรับเก็บข้อมูลแชตอย่างสมบูรณ์ เป้าหมายสำคัญที่สุดคือทำให้ผู้ใช้สามารถใช้งาน history ได้เร็ว โดยยังคงให้ implementation มีขนาดเล็กและปลอดภัย ผู้ใช้ต้องสามารถสร้างแชตใหม่และย้อนกลับมาดูแชตก่อนหน้าได้ภายใน browser เดียวกัน ขณะที่ระบบฐานข้อมูลปัจจุบันรองรับเฉพาะบัญชีผู้ใช้ ยังไม่ได้รองรับ chat records, file records หรือ message persistence

### Alternatives Considered
ทางเลือกหลักคือเก็บข้อมูลใน PostgreSQL ผ่านตาราง `conversations` และ `messages` อีกทางเลือกคือเก็บ chat history ใน server sessions หรือ JWTs แต่จะทำให้ cookie/session payload มีขนาดใหญ่เกินไป ส่วนอีกแนวทางคือใช้เพียง React state แบบ in-memory ซึ่งจะทำให้ข้อมูลหายทันทีเมื่อ refresh หน้าเว็บ

### Why localStorage
`localStorage` ช่วยให้สามารถบันทึกและโหลดข้อมูลได้ทันทีโดยไม่ต้องทำ database migrations เหมาะกับ milestone ของโปรเจกต์นักศึกษา และยังทำให้ประวัติแชตถูกเก็บเฉพาะใน browser ของผู้ใช้ปัจจุบัน implementation นี้รองรับหลาย conversations, การสร้างแชตใหม่, การตั้งชื่อ conversation อัตโนมัติ และการจำกัดขนาดข้อมูลเบื้องต้น โดยไม่เพิ่มความซับซ้อนฝั่ง backend

### Trade-offs
ประวัติแชตจะผูกกับอุปกรณ์และ browser นั้นเท่านั้น และอาจถูกลบได้เมื่อ browser clear site data ผู้ใช้ไม่สามารถกู้คืนข้อมูลหลังล้าง browser ได้ และไม่มีระบบ backup หรือ audit ฝั่ง server สำหรับ production ควรย้าย conversations และ messages ไปเก็บใน PostgreSQL พร้อมระบบตรวจสอบสิทธิ์ความเป็นเจ้าของข้อมูลของผู้ใช้

---

## Decision 3: ยังไม่จัดเก็บไฟล์อัปโหลดแบบถาวร

### Context
ปัจจุบันแอปใช้ไฟล์ TXT/PDF ที่อัปโหลดเป็น context สำหรับ AI request ในครั้งนั้นเท่านั้น ไฟล์ TXT จะถูกอ่านเป็นข้อความ ส่วน PDF จะถูกส่งไปยัง Gemini ในรูปแบบ inline PDF data ผู้ใช้เคยสอบถามว่าควรเก็บไฟล์หรือไม่และควรเก็บที่ใด เนื่องจากระบบยังไม่ได้พัฒนา RAG เต็มรูปแบบ จึงยังไม่มีความจำเป็นในการจัดเก็บ documents, extracted chunks หรือ embeddings แบบถาวร

### Alternatives Considered
หนึ่งในตัวเลือกคือเก็บไฟล์ลง PostgreSQL โดยตรงในรูปแบบ byte arrays แต่จะทำให้ฐานข้อมูลมีขนาดใหญ่และสำรองข้อมูลได้ยาก อีกทางเลือกคือบันทึกไฟล์ไว้ใน local server filesystem ซึ่งไม่เหมาะกับระบบ serverless หรือ container deployments สำหรับ production แนวทางที่เหมาะสมกว่าคือใช้ object storage เช่น Cloudflare R2, AWS S3, Supabase Storage หรือ Google Cloud Storage และเก็บ metadata ไว้ใน PostgreSQL

### Why Request-Time File Context
สำหรับขอบเขตงานปัจจุบัน การใช้ไฟล์เฉพาะใน request นั้นง่ายกว่าและช่วยหลีกเลี่ยงการจัดเก็บเอกสารที่อาจมีข้อมูลสำคัญโดยไม่จำเป็น นอกจากนี้ยังลดภาระด้านความปลอดภัย เช่น การเก็บรักษาไฟล์ การลบไฟล์ การควบคุมสิทธิ์การเข้าถึง และค่าใช้จ่ายด้าน storage แอปยังสามารถตรวจสอบประเภทไฟล์ จำกัดขนาด sanitize filenames และใช้เนื้อหาไฟล์ในการตอบคำถามของ AI ได้ตามต้องการ

### Trade-offs
ผู้ใช้ต้องอัปโหลดเอกสารใหม่ทุกครั้งหากต้องการใช้งานอีกครั้ง และระบบยังไม่สามารถทำ retrieval จาก document library ที่บันทึกไว้ได้ รวมถึงยังไม่มีฐานข้อมูลสำหรับ citation แบบถาวร หากพัฒนาเป็นระบบ RAG เต็มรูปแบบในอนาคต ควรจัดเก็บไฟล์ต้นฉบับใน Cloudflare R2 หรือ object storage อื่น เก็บ metadata ใน PostgreSQL และจัดเก็บ chunks/embeddings ใน ChromaDB หรือ pgvector