# Portfolio AI

This is an app made entirely using copilot and copilot AI agent pull requests. Made as a practice for interacting with these tools, evaluation what they can and cant do, their general competence and eventual integration into a more complex fully copilot built app.

Original prompt :

Purpose: Add a complete educational tutoring MVP under apps/edu-tutor providing AI-powered, hints-first learning.

Key features:

Hints-first vs Solution mode

Real-time streaming responses (SSE)

Content moderation (omni-moderation-latest)

Rate limiting (60 requests/min/IP)

No data persistence; privacy-focused

Accessible, responsive UI with dark/light mode and session export

Tech/architecture:

Next.js 14 (App Router), TypeScript, Tailwind CSS
OpenAI integration with gpt-4o-mini default (gpt-4o ready)

API routes: /api/chat (streaming), /api/moderate
Cost controls:

Input capped at 1,500 characters
Responses limited to ~800 tokens
Cost-effective default model (gpt-4o-mini)
Deployment:

Vercel-optimized, .env.example provided, comprehensive README
Isolated under apps/edu-tutor with clean file structure
That PR established the MVP’s educational focus, streaming UX, moderation and rate-limiting safeguards, and the initial model defaults.

Models used: 

GPT 4.1 - general

GPT 5 - prompt generation and pull requests

You can access a cloud stored version of this app on : https://portfolio-sepia-xi-98.vercel.app/ .

Everything beyond this point is fully AI generated.

## Educational Tutor Sub-App

This repository includes an AI-powered educational tutoring application located in [`apps/edu-tutor/`](./apps/edu-tutor/). The Educational Tutor provides a "hints-first" learning experience where students can:

- Ask educational questions and receive guided hints instead of direct answers
- Toggle between hints mode (1-2 guiding hints) and solution mode (complete explanations)  
- Experience real-time streaming responses for smooth interaction
- Export conversation history locally (no data is stored on servers)

**Tech Stack**: Next.js 14, TypeScript, Tailwind CSS, OpenAI API  
**Features**: Content moderation, rate limiting, mobile-responsive, accessible design  

The sub-app is completely self-contained and doesn't affect any existing portfolio content. See the [Educational Tutor README](./apps/edu-tutor/README.md) for detailed setup and deployment instructions.

## OpenAI Diagnostics (CI)

This repository includes a GitHub Actions workflow for testing OpenAI API connectivity securely. This is used to verify that the Educational Tutor can reach OpenAI services without exposing API keys in logs.

### Setup Instructions

1. **Add Repository Secret**
   - Go to your repository's **Settings** > **Secrets and variables** > **Actions**
   - Click **New repository secret**
   - Name: `OPENAI_API_KEY`
   - Value: Your OpenAI API key
   - Click **Add secret**

2. **Run Diagnostic Workflow**
   - Go to the **Actions** tab in your repository
   - Select **OpenAI Connectivity Diagnostic** workflow
   - Click **Run workflow**
   - Optionally specify a different model (default: `gpt-4o-mini`)
   - Click **Run workflow**

3. **Interpret Results**
   - ✅ Success: Look for `event=openai_diagnostic_ok` in the logs
   - ❌ Failure: Check the error details and verify your API key

### Security Notes

- The workflow **never logs or commits your API key**
- API responses are not printed to logs (only success/failure status)
- Failed requests show only HTTP status codes and generic error types
- This diagnostic is separate from the app runtime configuration
