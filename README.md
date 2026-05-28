# Enterprise Knowledge Platform: Production-Style Enterprise AI SaaS

An enterprise-ready AI Knowledge Platform built on Next.js 16 (App Router), Postgres, and ChromaDB. The system supports multi-tenant federated authentication (Credentials, Google, GitHub, LINE OAuth), real-time streaming chat, a dynamic HSL token-based theme engine with instant root-level theme syncing, and a resilient multi-provider AI failover architecture (Gemini Primary with Together, Cerebras, Groq, and OpenAI fallbacks).

---

## 🏛️ System Architecture

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js App)"]
        UI["Dynamic UI (HSL Tokens / Kanit Font)"]
        Theme["Theme Syncing Engine (Local Storage)"]
        SW["Service Worker / Event Stream Client"]
    end

    subgraph Security ["Security & Gateways"]
        Auth["NextAuth.js v5 (Federated Credentials & OAuth)"]
        RL["Rate Limiter (Token Bucket Gatekeeper)"]
    end

    subgraph Core ["Core Backend & Services"]
        API["Route Handlers (/api/chat)"]
        Failover["AI Failover Chain Selector"]
        Embedding["Gemini Embedding Engine"]
    end

    subgraph AI ["AI Provider Abstractions"]
        Gemini["Google Gemini (Primary)"]
        Together["Together AI (Llama 3.1)"]
        Cerebras["Cerebras AI (llama3.1-8b)"]
        Groq["Groq (Llama 3.1)"]
        OpenAI["OpenAI (GPT-4o Mini)"]
    end

    subgraph Storage ["Persistent Storage"]
        DB[(PostgreSQL Database)]
        Vector[(ChromaDB Vector Store)]
    end

    UI --> Theme
    UI --> Auth
    Auth --> API
    API --> RL
    RL --> Failover
    
    Failover --> Gemini
    Failover --> Together
    Failover --> Cerebras
    Failover --> Groq
    Failover --> OpenAI

    API --> Embedding
    Embedding --> Vector
    API --> DB
```

---

## 📂 Core Database Flow & Schema

The platform relies on a normalized relational layout designed for multi-tenant workspace partitioning, user membership controls, and full conversational auditing.

```
PostgreSQL Database
 ├── Users (Federated Credentials / Google / GitHub / LINE OAuth)
 ├── Workspaces (Enterprise Tenant Partitions)
 │     ├── Members (Workspace Membership Roles & Access Control)
 │     ├── Documents (Uploaded Corpus Metadata)
 │     ├── Conversations (Interactive Context Histories)
 │     └── Messages (Real-Time Exchange History & Auditing Tokens)
```

### Suggested Schema Structure

```sql
-- Conversations Table
CREATE TABLE conversations (
    id VARCHAR(255) PRIMARY KEY,
    workspace_id VARCHAR(255) REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages Table
CREATE TABLE messages (
    id VARCHAR(255) PRIMARY KEY,
    conversation_id VARCHAR(255) REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'user' | 'assistant'
    content TEXT NOT NULL,
    provider VARCHAR(100), -- 'Gemini' | 'Together' | 'Cerebras' | 'Groq' | 'OpenAI'
    token_usage JSONB, -- { "promptTokens": X, "completionTokens": Y, "totalTokens": Z }
    attachment_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Documents Table
CREATE TABLE documents (
    id VARCHAR(255) PRIMARY KEY,
    workspace_id VARCHAR(255) REFERENCES workspaces(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL, -- 'queued' | 'processing' | 'indexed' | 'failed'
    uploaded_by VARCHAR(255) REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## ⚡ Real-Time Chat & RAG Search Flow

### 1. Chat Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Enterprise User
    participant API as /api/chat Route Handler
    participant RL as Rate Limiter
    participant DB as PostgreSQL
    participant RAG as RAG Retrieval Engine
    participant Failover as Provider Failover Chain
    participant Client as SSE Stream Receiver

    User->>API: Send Message (conversationId, content, attachment)
    API->>RL: Check Rate Limit (20 req / min)
    RL-->>API: Limit Checked & Approved
    API->>DB: Load Conversation History
    API->>RAG: Retrieve Relevant Document Context (if TXT/PDF)
    RAG-->>API: Context Injected into System Prompt
    API->>Failover: Dispatch Stream Request
    Failover->>Failover: Try Gemini (Primary) -> Falls back to Together/Cerebras/Groq/OpenAI on Failure
    Failover-->>API: Return Active Stream Chunks & Token Usage
    API-->>Client: Stream SSE Tokens (event: token, provider, usage)
    API->>DB: Append Conversation Exchanges & Audit Token Usage
```

### 2. TXT / PDF RAG Pipeline

```mermaid
flowchart LR
    Doc["Upload Document"] --> Queue["BullMQ Job Queue"]
    Queue --> Worker["Async Worker Processor"]
    Worker --> Extract["Text Extraction & Sanitization"]
    Extract --> Chunk["Recursive Character Chunking (500 chars / 50 overlap)"]
    Chunk --> Embed["Gemini Embedding Engine (text-embedding-004)"]
    Embed --> Vector["ChromaDB Vector Storage"]
    Vector --> Metadata["Workspace Metadata Indexing"]
    Metadata --> Ready["Ready for Context Retrieval"]
```

---

## 🛡️ Resilient Multi-Provider AI Failover

The platform features an abstract, resilient client-side streaming engine that maps custom APIs under a unified streaming interface, ensuring **zero-downtime** operation.

### Failover Order

```
Gemini (Primary) ──► Together AI ──► Cerebras AI ──► Groq ──► OpenAI (GPT-4o Mini)
```

- **Primary Engine:** Google Gemini (Direct REST stream integration).
- **Secondary Engine:** Together AI (`Meta-Llama-3.1-8B-Instruct-Turbo` via OpenAI compatible endpoints).
- **Tertiary Engine:** Cerebras AI (`llama3.1-8b` via custom ultra-low latency compute endpoints).
- **Quaternary Engine:** Groq (`llama-3.1-8b-instant`).
- **Terminal Engine:** OpenAI (`gpt-4o-mini`).

---

## 🎨 Enterprise UX & Dynamic Styling

The UI incorporates rich, Harmonious design details following a premium custom typography system:
- **Google Fonts Typography:** Fully optimized loading of `Kanit` (ideal for highly legible Thai text) and `Inter` via Next.js `next/font/google`, integrated seamlessly into the CSS `@theme inline` mapping.
- **HSL CSS Variables Theme System:** Backgrounds, surfaces, borders, and fonts use variables (`bg-surface`, `border-border`, `text-foreground`, `text-muted`) that dynamically shift based on the document class (`.dark` or `.light`).
- **Dynamic Scrollbars:** Slim CSS scrollbars (`6px`, rounded) that instantly update track and thumb colors when changing themes, ensuring maximum alignment with the backdrop.
- **Automatic URL Query Cleanup:** On login or registration status changes, client-side query parameters (`?status=logged-in`, etc.) are securely cleared on mount, keeping browser refreshes pristine.

---

## 🐳 Docker compose & Local Setup

### 1. Requirements
- Docker and Docker Compose
- Node.js (v20+) & NPM

### 2. Single-Command Setup (Production Simulation)

```bash
docker compose up --build
```

The system will start:
- **Web App Service** on `http://localhost:3001` (Mapped from internal port `3000`)
- **PostgreSQL Database** on port `5432`
- **ChromaDB Vector Store** on `http://localhost:8000`

### 3. Local Development Setup (Manual)

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Configure Environment Variables (`.env`):**
   ```env
   # Authentication Secrets
   NEXTAUTH_SECRET=K7nP2sYx9VQ1rLm4uJ8cD3eT6wAaBbCcDdEeFfGg
   NEXTAUTH_URL=http://localhost:3000

   # Database & Storage
   DATABASE_URL=postgresql://user:password@localhost:5432/knowledge_assistant
   CHROMA_URL=http://localhost:8000

   # AI API Keys
   GEMINI_API_KEY=AIzaSyAee...
   TOGETHER_API_KEY=key_CbUZ2...
   CEREBRAS_API_KEY=csk-f53wn...
   GROQ_API_KEY=gsk_Yc1w...
   OPENAI_API_KEY=sk-proj-...

   # Federated OAuth Configurations
   AUTH_GOOGLE_ID=your_google_client_id
   AUTH_GOOGLE_SECRET=your_google_secret
   AUTH_GITHUB_ID=your_github_client_id
   AUTH_GITHUB_SECRET=your_github_secret
   AUTH_LINE_ID=your_line_client_id
   AUTH_LINE_SECRET=your_line_secret
   ```

3. **Start Development Server:**
   ```bash
   npm run dev
   ```

### 4. Running Unit Tests

```bash
npm run test
npm run test:coverage
```

---

## 📈 Observability & Analytics Metrics

The target SaaS dashboard is modeled to surface performance telemetry:
- **AI Requests Audit Log:** Real-time logging of active provider and response latency.
- **Token Efficiency Score:** Audits total token consumption per user, workspace, and provider.
- **Average Provider Latency:** Visualizes low-latency hardware (e.g. Cerebras) vs comprehensive models (e.g. Gemini, OpenAI).
- **Failover Success Rate:** Tracks failover frequency and system-wide availability.

---

## 🗺️ Priority Roadmap

### PHASE 1 — Core Foundation (Completed)
- [x] Database Chat History Persistence.
- [x] NextAuth v5 credentials + Federated OAuth (Google, Github, LINE).
- [x] Document Validation & Custom Sanitize Pipeline.
- [x] Zero-downtime AI Multi-Provider Fallback.
- [x] Dynamic HSL CSS Theme Synced Scrollbars & Google Typography.

### PHASE 2 — Enterprise Integration (Active)
- [ ] Secure Multi-tenant Workspace Partitioning.
- [ ] Redis Token Bucket Rate Limiting.
- [ ] Real-time Admin Telemetry & Observability Dashboard.

### PHASE 3 — Scalable Infrastructure (Planned)
- [ ] BullMQ Background Processing Workers.
- [ ] Multi-tenant ChromaDB Collection Isolation.
- [ ] S3-Compatible Persistent Storage for Original Attachments.
