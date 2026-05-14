# Trainee Knowledge Assistant

AI chat web app สำหรับถามตอบความรู้จากไฟล์เอกสาร โดยมีระบบล็อกอิน, protected route, แนบไฟล์ TXT/PDF, streaming response, markdown rendering, citation, token usage counter และ conversation history

## Description ย่อ

Trainee Knowledge Assistant คือเว็บแชท AI สำหรับผู้ใช้ที่ต้องการอัปโหลดเอกสารแล้วถามตอบจากเนื้อหาในไฟล์อย่างรวดเร็ว พร้อมระบบยืนยันตัวตน การนับ token แบบราย session และคำตอบแบบ streaming ที่อ่านง่ายด้วย Markdown

## Tech Stack

- Next.js 16 App Router
- React 19
- NextAuth credentials session
- PostgreSQL สำหรับ user accounts
- bcrypt สำหรับ hash password
- Gemini API สำหรับ AI response
- Docker Compose สำหรับ app/database services

## Features

- Login และ protected `/chat` route
- Register user พร้อม bcrypt password hashing
- Upload TXT/PDF พร้อม validate type, size และ sanitize filename
- Chat with AI ผ่าน Gemini streaming API
- Chat with uploaded file context
- Markdown rendering ในคำตอบ AI
- Citation prompt ให้ AI อ้างอิงเอกสารด้วยชื่อไฟล์
- Token usage counter ต่อ session
- Conversation history เก็บใน browser localStorage
- Rate limiting พื้นฐานที่ `/api/chat`
- API key rotation ผ่าน `GEMINI_API_KEYS`
- Security headers ผ่าน `next.config.ts`
- Docker Compose และ healthcheck endpoint

## Project Structure

```txt
src/
  app/
    api/
      chat/route.ts          # Chat API route, auth guard, rate limit, SSE
      auth/[...nextauth]/    # NextAuth handlers
      health/route.ts        # Healthcheck endpoint
    chat/
      page.tsx               # Protected chat page
      chat-client.tsx        # Chat state and streaming client
    login/page.tsx
    register/page.tsx
  components/
    chat/
      chat-composer.tsx
      chat-sidebar.tsx
      markdown-message.tsx
      message-list.tsx
      token-usage-badge.tsx
  lib/
    auth.ts                  # NextAuth config
    users.ts                 # User repository/database access
    chat/
      gemini.ts              # Gemini service
      types.ts
      validation.ts
    security/
      rate-limit.ts
```

## Environment Variables

สร้างไฟล์ `.env` จาก `.env.example`

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_API_KEYS=
GEMINI_MODEL=gemini-2.5-flash
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
AUTH_EMAIL=admin@example.com
AUTH_PASSWORD_HASH=
DATABASE_URL=postgresql://admin:password@localhost:5432/knowledge_assistant
CHROMA_URL=http://localhost:8000
```

หมายเหตุ:
- ถ้า `gemini-2.5-flash` ใช้ไม่ได้กับ key ของคุณ ให้ลอง `GEMINI_MODEL=gemini-2.0-flash`
- แนะนำให้ใช้ user จาก database ผ่านหน้า register
- ถ้าต้องการ fallback admin account ให้ใส่ `AUTH_EMAIL` และ `AUTH_PASSWORD_HASH` ที่ hash ด้วย bcrypt

## Getting Started

ติดตั้ง dependencies:

```bash
npm install
```

รัน development server:

```bash
npm run dev
```

เปิดเว็บ:

```txt
http://localhost:3000
```

ตรวจคุณภาพโค้ด:

```bash
npm run lint
npm run build
```

## Docker

รันด้วย Docker Compose:

```bash
docker compose up --build
```

Healthcheck endpoint:

```txt
GET /api/health
```

## Rubric Coverage

- Login + Protected Routes: implemented with NextAuth, bcrypt และ protected proxy
- Upload File: TXT/PDF validation, size limit และ filename sanitization
- Chat with AI: Gemini streaming route พร้อม error handling และ timeout
- Chat with Uploaded File Context: TXT context และ PDF inline data ไปยัง Gemini
- Token Usage Counter: แสดงผลรวม token ต่อ session
- Markdown Rendering: render heading, list, bold, inline code และ code block
- Citation: prompt ให้ AI อ้างอิงไฟล์ด้วย `[filename]`
- Streaming Response: Server-Sent Events จาก API route
- Conversation History: save/load ผ่าน localStorage
- Rate Limiting / API Key Rotation: memory rate limit และ `GEMINI_API_KEYS`
- Docker Compose + Healthcheck: มี `docker-compose.yml` และ `/api/health`
- Code Structure: แยก route/service/repo/component ชัดเจน
- Security Hardening: auth guard, bcrypt, input validation, sanitization และ security headers

## Current Limitations

- Vector DB/RAG แบบ embedding retrieval ยังไม่ได้เชื่อมเต็มรูปแบบ
- Unit test coverage ยังไม่ได้เพิ่ม
- Conversation history ตอนนี้เก็บฝั่ง browser ไม่ใช่ database
