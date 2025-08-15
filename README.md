# Portfolio

This is my personal portfolio repository.

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