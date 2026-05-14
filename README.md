# Knowledge Assistant

Knowledge Assistant is a protected AI chat web app for asking questions with optional TXT/PDF document context. It supports login, file validation, streaming Gemini responses, markdown rendering, citations, token counting, new chat, and local chat history.

## Tech Stack

- Framework: Next.js 16 App Router, React 19, TypeScript
- Auth: NextAuth credentials provider, bcrypt password hashing
- Database: PostgreSQL for user accounts
- Vector DB: ChromaDB (RAG for TXT via chunk + Gemini embeddings + retrieval when `CHROMA_URL` is set)
- AI: Google Gemini API
- Infra: Docker Compose

## Setup & Run

1-command setup:

```bash
docker compose up --build
```

Local development:

```bash
npm install
npm run dev
```

Open:

```txt
http://localhost:3000
```

Required environment variables:

```env
GEMINI_API_KEY=your_gemini_key
GEMINI_API_KEYS=
GEMINI_MODEL=gemini-2.5-flash
NEXTAUTH_SECRET=your_secret
NEXTAUTH_URL=http://localhost:3000
AUTH_EMAIL=admin@example.com
AUTH_PASSWORD_HASH=
DATABASE_URL=postgresql://admin:password@db:5432/knowledge_assistant
CHROMA_URL=http://chromadb:8000
```

If `gemini-2.5-flash` is not available for your API key, set:

```env
GEMINI_MODEL=gemini-2.0-flash
```

## Features Done

- [x] Login + Protected Routes
- [x] Register user with bcrypt password hashing
- [x] File Upload
- [x] TXT/PDF type validation
- [x] File size validation
- [x] Filename sanitization
- [x] Chat with AI
- [x] Streaming response
- [x] Timeout and API error handling
- [x] Chat with uploaded file context
- [x] Markdown rendering
- [x] Citation prompt using uploaded filename
- [x] Token usage counter per chat session
- [x] New chat
- [x] Conversation history
- [x] Rate limiting
- [x] API key rotation via `GEMINI_API_KEYS`
- [x] Docker Compose + healthcheck
- [x] RAG with Vector DB (TXT: chunk + Gemini embeddings + Chroma retrieval; PDF unchanged)
- [x] Unit tests (`npm run test:coverage`, Vitest + V8; coverage thresholds on core `src/lib` modules listed in `vitest.config.ts`)

## Architecture

The app uses Next.js App Router with Server Components for protected pages and Client Components for interactive chat state.

- `src/app/chat/page.tsx`: protected chat page; redirects unauthenticated users to login
- `src/app/chat/chat-client.tsx`: client-side chat state, new chat, local history, file attachment handling, and SSE consumption
- `src/app/api/chat/route.ts`: authenticated chat API route with rate limiting, request validation, and Server-Sent Events streaming
- `src/lib/auth.ts`: NextAuth configuration
- `src/lib/users.ts`: user repository and PostgreSQL access
- `src/lib/chat/gemini.ts`: Gemini service layer
- `src/lib/chat/validation.ts`: message and attachment validation
- `src/components/chat/*`: reusable chat UI components

Current file handling:

- TXT files are read in the browser and sent as text context.
- PDF files are converted to base64 in the browser and sent to Gemini as inline PDF data.
- Uploaded files are not permanently stored yet.

Recommended production storage:

- Store original PDF/TXT files in object storage such as Cloudflare R2, AWS S3, Supabase Storage, or Google Cloud Storage.
- Store file metadata in PostgreSQL: owner user id, original filename, sanitized storage key, MIME type, size, upload time.
- Store extracted chunks and embeddings in a vector DB such as ChromaDB, pgvector, Pinecone, Qdrant, or Weaviate.
- For this project, Cloudflare R2 is a good fit if you want cheap S3-compatible storage; PostgreSQL should still keep metadata and ownership.

## Known Issues

- RAG over Chroma applies to **TXT** attachments when `CHROMA_URL` is set; **PDF** still uses inline PDF to Gemini (no vector indexing yet).
- Chat history is stored in browser `localStorage`, not PostgreSQL, so it is device/browser-specific.
- Uploaded files are used only for the current request and are not persisted.
- PDF quality depends on Gemini's inline PDF handling; there is no separate PDF text extraction pipeline yet.
- Unit tests use Vitest; coverage thresholds apply to the file globs in `vitest.config.ts` (not the entire monorepo).
- In-memory rate limiting resets when the server restarts and is not shared across multiple instances.
