# Architecture Decision Records (ADR)

This document records the critical architectural decisions made during the design and implementation of the Enterprise Knowledge Platform.

---

## 🧭 ADR 1: Unified Next.js App Router for Web & Web-API Gateways

### Context
The platform requires secure federated authentication, protected file uploads, real-time message streaming (SSE), and secure key storage. We chose **Next.js 16 (App Router)** as the core structural framework.

### Alternatives Considered
- **Decoupled Architecture (React SPA + Express/Fastify Backend):** Provides clear physical isolation, but introduces multiple deployment vectors, cross-origin resource sharing (CORS) complexity, and multiple points of failure.
- **Client-Side Direct AI Requests:** Minimizes server overhead but exposes sensitive API credentials and limits telemetry collection.

### Decision
Utilize Next.js App Router. We run server-side logic inside **Server Components** and **Route Handlers (`/api/*`)** to protect secrets, while client-side states handle interactions like streaming and files.

### Consequences
- **Security:** Zero client exposure of AI API keys or PostgreSQL connection URLs.
- **Complexity:** Must maintain strict client vs. server boundaries (`"use client"` tags).
- **Scale:** Simplifies single-container deployment, making the application highly portable.

---

## 🗄️ ADR 2: Relational PostgreSQL Database for Conversation History Persistence

### Context
Conversations must persist across devices, reload automatically, and support analytical querying. While a temporary storage structure like `localStorage` was considered for early prototyping, it fails to meet enterprise requirements.

### Alternatives Considered
- **Pure Local Storage (`localStorage`):** Easy to implement but fails to support cross-device sync, session management, or analytics auditing.
- **NoSQL / Document Store (MongoDB):** Highly compatible with chat transcripts, but introduces an additional infrastructure dependency alongside our relational user database.

### Decision
Implement server-side persistent conversation storage using **PostgreSQL**. The history is synchronized securely via relational foreign keys linked to authenticated user records.

### Consequences
- **Data Integrity:** Fully relational referential constraints ensure messages, attachments, and users stay structurally in-sync.
- **Auditability:** Telemetry metrics (such as the provider name and tokens used) are saved directly in database columns alongside conversational payloads, enabling precise monitoring.
- **Performance:** Complex queries for analytics and dashboards can be ran using traditional SQL indices.

---

## 🔐 ADR 3: NextAuth.js v5 Federated Credentials & OAuth Integration

### Context
To accommodate diverse user profiles, the platform must support both traditional email/password credentials and enterprise single sign-on (SSO) or social OAuth logins (Google, GitHub, LINE).

### Alternatives Considered
- **Custom Session Handling & Cookie Management:** Highly customizable, but increases security risks, cookie hijacking vulnerabilities, and manual token refresh overhead.
- **Third-Party Identity SaaS (Auth0, Clerk):** Excellent developer experience but introduces subscription fees and lock-in.

### Decision
Integrate **NextAuth.js v5 (Auth.js)** as the federated security layer. We implemented:
1. **Credentials Provider:** Uses `bcrypt` for secure hashing and validation of passwords stored in PostgreSQL.
2. **Social OAuth Providers:** Integrates Google, GitHub, and LINE.
3. **Database Federation:** On successful OAuth sign-in, the system automatically checks if the user exists and creates a relational user record (with a `NULL` password hash) if they are new.

### Consequences
- **Developer & User Experience:** High-speed sign-in flows with secure cross-origin redirection.
- **Session Extensibility:** User database UUIDs and avatars are injected directly into JWT session states, making them available in Server Components.

---

## 🔄 ADR 4: Gemini Primary with Multi-Provider Failover Abstraction

### Context
AI rate limits, outages, and regional network constraints present a risk to SaaS availability. A robust system must survive primary provider failure without degrading the user experience.

### Alternatives Considered
- **Single Provider Configuration:** Simple to implement but lacks resilience.
- **Serverless API Gateway (OpenRouter Exclusive):** Extremely convenient, but introduces single-point-of-failure routing and higher API costs.

### Decision
Implement an abstract, local **Multi-Provider Failover Chain**.
- **Google Gemini** serves as the primary model.
- **Together AI** (`Meta-Llama-3.1-8B-Instruct-Turbo`) and **Cerebras AI** (`llama3.1-8b`) serve as the secondary failover systems, followed by **Groq** and **OpenAI** as terminal fallbacks.
- The backend catches stream errors and automatically falls back to the next provider, sending an `event: provider` event down the server-sent events (SSE) stream to keep the client informed.

### Consequences
- **High Availability:** If Gemini fails, the system recovers and delivers responses transparently.
- **Low Latency:** Incorporating ultra-low latency compute engines (e.g. Cerebras) maintains high-speed responses.

---

## 🎨 ADR 5: Unified HSL Token Styling & Dynamic Root-Level Theme Syncing

### Context
Modern web platforms require cohesive dark/light transitions. Classic utility-based color toggles often lead to inconsistencies, unreadable code snippets, or flashing browser scrollbars.

### Decision
Adopt a unified **HSL Token Design System** utilizing Tailwind CSS v4 variables:
1. **Dynamic CSS Variables:** We define tokens like `--background`, `--foreground`, `--surface`, and `--border` in `.dark` and `.light` styles inside [globals.css](file:///c:/Users/User/trainee-knowledge-assistant/src/app/globals.css).
2. **Standard Utility Mapping:** Variables are mapped inside Tailwind's `@theme inline` directive, exposing dynamic utility classes like `text-muted`, `bg-surface`, and `border-border`.
3. **Root-Level Syncing:** The Client Component [chat-client.tsx](file:///c:/Users/User/trainee-knowledge-assistant/src/app/chat/chat-client.tsx) monitors theme states, writes preferences to local storage, and syncs them directly to the `document.documentElement` class list.

### Consequences
- **Consistency:** Scrollbars, markdown text, message bubbles, and preformatted code blocks transition dynamically without hardcoded colors.
- **Readability:** Web-safe font smoothing adjustments (`-webkit-font-smoothing`) are dynamically adapted per theme to ensure legibility.
