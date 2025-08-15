# Portfolio Repository with Educational Tutor App

**ALWAYS** reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

This repository contains a personal portfolio with an AI-powered Educational Tutor web application located in `apps/edu-tutor/`. The Educational Tutor provides hints-first learning experiences using Next.js 14, TypeScript, and OpenAI's API.

## Working Effectively

### Prerequisites & Environment Setup
- **Node.js Version**: REQUIRED Node.js 18+. Current environment runs v20.19.4 which is compatible.
- **Package Manager**: Use npm (v10.8.2+)
- **OpenAI API Key**: Required for functionality - see Environment Configuration below

### Bootstrap, Build, and Run Process
Execute these commands in sequence from repository root:

1. **Navigate to the app directory**:
   ```bash
   cd apps/edu-tutor
   ```

2. **Install dependencies**: 
   ```bash
   npm install
   ```
   - **TIMING**: Takes 7-55 seconds (depending on npm cache). NEVER CANCEL. Set timeout to 120+ seconds.

3. **Environment Configuration**:
   ```bash
   cp .env.example .env.local
   ```
   Then edit `.env.local` and set your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_openai_api_key_here
   DEFAULT_MODEL=gpt-4o-mini
   QUALITY_MODEL=gpt-4o
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=60
   ALLOWED_ORIGIN=*
   ```

4. **Build the application**:
   ```bash
   npm run build
   ```
   - **TIMING**: Takes approximately 19 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
   - **SUCCESS**: Should show route table with static (○) and dynamic (ƒ) routes
   - **OUTPUT**: Creates `.next/` production build directory

5. **Development server**:
   ```bash
   npm run dev
   ```
   - **TIMING**: Ready in ~1.5 seconds
   - **ACCESS**: http://localhost:3000
   - **BEHAVIOR**: Hot reloading enabled, TypeScript compilation on-demand

6. **Production server** (after build):
   ```bash
   npm start
   ```
   - **TIMING**: Ready in ~300ms
   - **REQUIREMENT**: Must run `npm run build` first
   - **ACCESS**: http://localhost:3000

### Linting and Quality Checks
```bash
npm run lint
```
- **TIMING**: Takes ~2 seconds. Set timeout to 30+ seconds.
- **EXPECTATION**: Should show "No ESLint warnings or errors"
- **CRITICAL**: ALWAYS run before committing changes or CI will fail

## Application Architecture

### Key Components
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript 
- **Styling**: Tailwind CSS
- **AI Integration**: OpenAI SDK v4.67.3
- **Validation**: Zod for type safety

### Repository Structure
```
/
├── README.md                    # Main portfolio README
├── PROJECT_BRIEF.md            # Detailed app specifications
├── apps/
│   └── edu-tutor/              # Educational Tutor Next.js app
│       ├── app/                # Next.js App Router pages
│       │   ├── page.tsx        # Main chat interface
│       │   ├── about/page.tsx  # About page
│       │   ├── layout.tsx      # Root layout
│       │   └── api/            # API routes
│       │       ├── chat/route.ts      # Streaming chat endpoint
│       │       └── moderate/route.ts  # Content moderation
│       ├── components/         # React components
│       │   ├── Chat.tsx        # Main chat component
│       │   └── Toggle.tsx      # Hints mode toggle
│       ├── lib/                # Utilities
│       │   ├── openai.ts       # OpenAI client
│       │   ├── prompts.ts      # System prompts
│       │   └── rateLimit.ts    # Rate limiting logic
│       ├── package.json        # Dependencies and scripts
│       ├── .env.example        # Environment template
│       └── README.md           # App-specific documentation
```

## Validation Scenarios

### CRITICAL: Manual Testing Requirements
After making ANY changes, you MUST validate the complete application functionality:

#### 1. Basic Application Loading
```bash
# Start dev server
cd apps/edu-tutor && npm run dev
```
- **VERIFY**: Navigate to http://localhost:3000
- **EXPECTED**: Page loads with "Educational Tutor" heading
- **EXPECTED**: Chat interface with textarea and disabled Send button
- **EXPECTED**: "Hints mode" toggle in enabled state

#### 2. User Interface Functionality  
- **Type in chat box**: Enter "What is 2+2?" 
- **VERIFY**: Character counter updates (shows "12/1500 characters")
- **VERIFY**: Send button becomes enabled
- **VERIFY**: Hints mode toggle can be clicked and changes state

#### 3. Navigation Testing
- **Click "About" link**
- **VERIFY**: Navigates to /about page showing app information
- **VERIFY**: "← Back to Chat" link returns to home page
- **EXPECTED**: No JavaScript errors in browser console

#### 4. API Endpoint Testing
```bash
# Test moderation endpoint (dev server must be running)
curl -X POST http://localhost:3000/api/moderate \
  -H "Content-Type: application/json" \
  -d '{"input": "This is a test message"}'
```
- **EXPECTED**: JSON response with flagged, categories, and category_scores fields
- **EXPECTED**: HTTP 200 status code

#### 5. Production Build Testing
```bash
npm run build && npm start
```
- **VERIFY**: Production server starts without errors
- **VERIFY**: All pages load correctly in production mode

### Error Scenarios to Test
- **Missing API Key**: Application should handle gracefully (check /api/chat behavior)
- **Invalid Input**: Test moderation endpoint with empty or oversized input
- **Rate Limiting**: Test exceeding 60 requests per minute if implementing changes to rate limiter

## Environment Configuration Details

### Required Environment Variables
| Variable | Purpose | Default Value | Required |
|----------|---------|---------------|----------|
| `OPENAI_API_KEY` | OpenAI API authentication | - | **YES** |
| `DEFAULT_MODEL` | Primary GPT model | `gpt-4o-mini` | No |
| `QUALITY_MODEL` | High-quality model option | `gpt-4o` | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `60000` | No |
| `RATE_LIMIT_MAX` | Max requests per window | `60` | No |
| `ALLOWED_ORIGIN` | CORS origin | `*` | No |

### OpenAI API Key Setup
- **TESTING**: Use format `sk-test-mock-key-for-validation-only` for local validation
- **PRODUCTION**: Requires valid OpenAI API key from https://platform.openai.com/
- **SECURITY**: NEVER commit real API keys to repository

## Common Development Tasks

### Making Code Changes
1. **ALWAYS** run the validation scenarios above after changes
2. **ALWAYS** run `npm run lint` before committing
3. **ALWAYS** test both development and production builds
4. **CRITICAL**: Verify the chat interface and API endpoints work correctly

### Working with APIs
- **Chat Endpoint**: POST /api/chat with `{message: string, mode?: "hints" | "solution"}`
- **Moderation**: POST /api/moderate with `{input: string}`
- **Rate Limiting**: 60 requests/minute per IP address
- **Streaming**: Chat uses Server-Sent Events for real-time responses

### Deployment Notes
- **Vercel**: Set root directory to `apps/edu-tutor` when deploying
- **Environment**: Configure all environment variables in deployment platform
- **Build Command**: `npm run build` (from apps/edu-tutor directory)
- **Start Command**: `npm start`

## File System Quick Reference

### Key Configuration Files
- `apps/edu-tutor/package.json`: Dependencies, scripts, Node.js version requirement
- `apps/edu-tutor/.eslintrc.json`: ESLint configuration for Next.js
- `apps/edu-tutor/next.config.js`: Next.js configuration
- `apps/edu-tutor/tailwind.config.ts`: Tailwind CSS configuration
- `apps/edu-tutor/tsconfig.json`: TypeScript configuration

### Frequently Modified Files
- `apps/edu-tutor/app/api/chat/route.ts`: Main chat API logic
- `apps/edu-tutor/components/Chat.tsx`: Client-side chat interface
- `apps/edu-tutor/lib/prompts.ts`: System prompts and AI instructions
- `apps/edu-tutor/lib/openai.ts`: OpenAI client configuration

## Troubleshooting Common Issues

### Build Failures
- **Missing dependencies**: Run `npm install` first
- **TypeScript errors**: Check `npm run lint` output
- **Environment issues**: Verify `.env.local` exists and has required variables

### Runtime Errors  
- **API key errors**: Check OpenAI API key configuration
- **CORS errors**: Verify ALLOWED_ORIGIN setting
- **Rate limiting**: Wait 1 minute or check rate limit configuration

### Performance Issues
- **Slow responses**: Check OpenAI API status and model selection
- **Build time**: ~19 seconds is normal, longer may indicate dependency issues
- **Memory usage**: Monitor during development, restart dev server if needed

---

**Educational Tutor Portfolio App** - AI-powered hints-first learning platform 🎓