# Project Brief: Educational Tutor Web App (MVP)

Goal
- Build a web app that helps students learn with hints-first tutoring. The assistant explains step-by-step, offers hints before revealing solutions, and keeps answers concise by default.

Non-goals (MVP)
- No user accounts, payments, or persistence.
- No curriculum ingestion/RAG.
- No teacher dashboard.
- No mobile app.

Tech Stack
- Framework: Next.js 14 (App Router) + TypeScript
- Styling: Tailwind CSS
- UI: Minimal components (no heavy UI kit). Keep it clean and accessible.
- Backend: Next.js API routes (Edge/Node as appropriate).
- AI SDK: Official OpenAI Node SDK
- Hosting: Vercel
- Env management: .env.local in dev; Vercel env vars in prod

OpenAI Usage
- Default model: gpt-4o-mini
- Optional high-quality path: gpt-4o, behind a flag/param for specific “quality” tasks
- Moderation: omni-moderation-latest on user input before model call
- Streaming: Stream assistant tokens to the client for responsive UX
- Prompt policy:
  - System: “You are a helpful, encouraging tutor. Explain concepts step-by-step. Offer 1–2 hints before full solutions. Be concise by default. Age-appropriate, neutral tone.”
  - Add a safety rule: “If the user asks for disallowed or inappropriate content, politely refuse and redirect to safe educational content.”
- Cost control:
  - Trim inputs to a safe length (e.g., 1,500 characters).
  - Set temperature ~0.5 and encourage concise outputs.
  - Log token usage per request (if available) without storing content.

Pages and UX
- Home page (/) with a single chat-style interface:
  - Textarea for user question.
  - “Hints mode” toggle: when ON, assistant gives hints first; when user clicks “Show solution,” request the final solution.
  - Streaming response area with typing effect.
  - Subtle cost/latency hint in UI: “Responses are streamed for speed; keep prompts short.”
  - “Report content” button that opens a simple form (client-only) to copy current session content into an email template or downloaded text for later review (no backend storage).
- About page (/about) with brief app purpose and privacy notes:
  - “No accounts, no data storage in MVP. Your messages are sent to the AI provider to generate responses. Do not enter personal data.”

API Endpoints
- POST /api/chat
  - Body: { message: string, mode?: "hints" | "solution" }
  - Behavior: Run moderation on message. If flagged, return a safe refusal. For “hints” mode, ask model to give 1–2 hints and stop before the full solution. For “solution” mode, provide the full explanation + final answer.
  - Streaming: Yes. Use SSE or Next.js AI streaming utilities.
  - Rate limiting: 60 requests/min/IP (respond 429 on exceed).
  - Log: timestamp, request_id, model, latency, token counts if available (no prompt storage).
- POST /api/moderate
  - Body: { input: string }
  - Behavior: Call omni-moderation-latest and return result.
  - Used by /api/chat internally.

Architecture
- Next.js App Router with a server action or route handler for /api/chat.
- Use the official OpenAI SDK on the server only (never expose keys).
- Implement a small rate limiter (in-memory for MVP is okay). Structure code to swap in a durable store later.
- Keep the system prompt short. Add an optional developer “policy” string that can be extended without changing code.

Configuration (.env)
- OPENAI_API_KEY=
- DEFAULT_MODEL=gpt-4o-mini
- QUALITY_MODEL=gpt-4o
- RATE_LIMIT_WINDOW_MS=60000
- RATE_LIMIT_MAX=60
- ALLOWED_ORIGIN=*

Security and Privacy
- Do not log or persist prompt/response content in MVP.
- Strip or ignore suspicious large inputs.
- CORS: restrict to site origin in production.
- Never expose API keys client-side.

Testing and QA
- Unit: basic utilities (input trimming, mode handling).
- Integration: /api/chat returns streamed content; verify hints vs solution behavior.
- Manual QA checklist:
  - Short question receives 1–2 hints when “Hints mode” is ON.
  - Clicking “Show solution” yields a complete explanation and final answer.
  - Inappropriate prompt triggers a polite refusal.
  - Rate limit returns HTTP 429 when exceeded.
  - No API key in client bundle.
  - Works on mobile (small screens), keyboard accessible, focus states visible.

Accessibility
- Labels for inputs and buttons.
- Live region for streamed text.
- Color contrast meets WCAG AA baseline.

Performance
- Ship minimal JS on the client; no heavy dependencies.
- Use streaming to show content quickly.

Repository Structure
- /app
  - /page.tsx — main chat UI
  - /about/page.tsx
  - /api/chat/route.ts — streamed responses
  - /api/moderate/route.ts
- /components
  - Chat.tsx (client component that handles streaming)
  - Toggle.tsx (hints mode)
- /lib
  - openai.ts (server-side OpenAI client)
  - rateLimit.ts
  - prompts.ts (system + policy text)
- /styles
  - globals.css (Tailwind)
- README.md
- .env.example
- next.config.js
- tailwind.config.ts
- postcss.config.js

Deliverables
- Complete working Next.js app with the above pages and endpoints.
- Streaming responses using the chosen model.
- Rate limiting and moderation in place.
- README with setup (npm i, env, npm run dev), deployment steps (Vercel).
- Clear comments where to later plug in: authentication, persistence (DB), content library/RAG.

Stretch (optional if time allows)
- Button: “Regenerate hints”
- Copy response to clipboard
- Minimal theming (light/dark)
- Simple token estimate next to the Send button

Acceptance Criteria
- User can ask a question and see a streamed response.
- Hints mode provides hints first; solution mode provides full explanation with a final answer.
- Moderation prevents disallowed content from being processed.
- App deploys on Vercel and works on desktop and mobile.
- No secrets in client; .env.example provided.