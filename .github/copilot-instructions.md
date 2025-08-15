# Portfolio Repository - Educational Tutor

Always follow these instructions first and fallback to additional search and context gathering only if the information here is incomplete or found to be in error.

## Repository Overview
This is a portfolio repository containing an AI-powered Educational Tutor web application located in `apps/edu-tutor/`. The Educational Tutor is a Next.js 14 application that provides hints-first learning experiences using OpenAI's GPT models.

## Working Effectively

### Bootstrap and Setup
- Navigate to the project directory: `cd apps/edu-tutor`
- Install dependencies: `npm install` -- takes ~83 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
- Set up environment variables: `cp .env.example .env.local`
- Edit `.env.local` and add your OpenAI API key:
  ```
  OPENAI_API_KEY=your_openai_api_key_here
  DEFAULT_MODEL=gpt-4o-mini
  QUALITY_MODEL=gpt-4o
  RATE_LIMIT_WINDOW_MS=60000
  RATE_LIMIT_MAX=60
  ALLOWED_ORIGIN=*
  ```
- **IMPORTANT**: Without a valid OpenAI API key, the chat functionality will return moderation errors, but the UI and basic functionality can still be tested.

### Build and Development
- **Development server**: `npm run dev` -- starts in ~1.5 seconds. NEVER CANCEL.
  - Available at http://localhost:3000
  - Supports hot reloading
  - Uses .env.local environment file
- **Production build**: `npm run build` -- takes ~13 seconds. NEVER CANCEL. Set timeout to 60+ seconds.
  - Creates optimized build in `.next` directory
  - Includes TypeScript checking and linting
- **Production server**: `npm start` -- starts in ~0.3 seconds after successful build
  - Requires `npm run build` to be run first
  - Serves from `.next` directory
- **Linting**: `npm run lint` -- takes ~2 seconds. Always run before committing.

### Key Commands Summary
```bash
cd apps/edu-tutor
npm install          # ~83s - NEVER CANCEL, use 120s+ timeout
npm run build        # ~13s - NEVER CANCEL, use 60s+ timeout  
npm run dev          # ~1.5s startup
npm start            # ~0.3s (requires build first)
npm run lint         # ~2s - run before committing
```

## Validation Scenarios

### Manual Testing Requirements
After making any code changes, ALWAYS test these complete user scenarios:

1. **Hints Mode Workflow** (Default):
   - Navigate to http://localhost:3000
   - Verify "Hints mode" toggle is ON (checked)
   - Enter an educational question (e.g., "What is photosynthesis?")
   - Click "Send"
   - Verify response provides 1-2 hints without full solution
   - Test character limit (1500 max)

2. **Solution Mode Workflow**:
   - Toggle "Hints mode" OFF
   - Enter the same or different educational question
   - Click "Send"
   - Verify response provides complete explanation with final answer

3. **Content Moderation**:
   - Enter inappropriate content
   - Verify polite refusal message appears
   - Verify redirection to educational topics

4. **Rate Limiting**:
   - Send multiple requests rapidly
   - Verify 429 rate limit response after 60 requests/minute

5. **Session Management**:
   - Test "Copy Session" button functionality
   - Test "Export Session" button functionality
   - Navigate to /about page and verify content loads
   - Navigate back to main chat interface

### API Testing Commands
```bash
# Test moderation endpoint
curl -X POST http://localhost:3000/api/moderate \
  -H "Content-Type: application/json" \
  -d '{"input": "This is a test message"}'

# Test chat endpoint - hints mode
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2+2?", "mode": "hints"}'

# Test chat endpoint - solution mode  
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2+2?", "mode": "solution"}'
```

**Note**: Without a valid OpenAI API key, the moderation endpoint may return `{"flagged":true,"categories":{},"category_scores":{}}` and the chat endpoints will return the moderation refusal message. This is expected behavior and indicates the API endpoints are working correctly.

## Repository Structure and Navigation

### Key Directories
```
apps/edu-tutor/
├── app/                 # Next.js App Router
│   ├── page.tsx        # Main chat interface
│   ├── about/          # About page
│   ├── layout.tsx      # App layout
│   ├── globals.css     # Global styles
│   └── api/            # API endpoints
│       ├── chat/       # Main chat streaming API
│       └── moderate/   # Content moderation API
├── components/         # React components
│   ├── Chat.tsx       # Main chat component (client-side)
│   └── Toggle.tsx     # Hints mode toggle
├── lib/               # Utilities and configuration
│   ├── openai.ts     # OpenAI client setup
│   ├── rateLimit.ts  # Rate limiting logic
│   └── prompts.ts    # System prompts and messages
└── public/           # Static assets
```

### Important Files to Check When Making Changes
- Always check `lib/prompts.ts` when modifying AI behavior or system messages
- Check `app/api/chat/route.ts` when working with streaming or API logic
- Check `components/Chat.tsx` for UI state management and client-side logic
- Check `.env.example` for required environment variables
- Check `package.json` for available scripts and dependencies

## Environment and Dependencies

### Prerequisites
- **Node.js**: 18+ required (specified in package.json engines)
- **npm**: For dependency management
- **OpenAI API Key**: Required for chat functionality
- No database required (in-memory rate limiting for MVP)

### Tech Stack
- **Framework**: Next.js 14 (App Router) + TypeScript
- **Styling**: Tailwind CSS with dark/light mode support
- **AI**: OpenAI API (gpt-4o-mini default, gpt-4o optional)
- **Backend**: Next.js API Routes (Node.js runtime)
- **Dependencies**: React 18, OpenAI SDK, Zod for validation

### Build Artifacts and Cleanup
- Build output goes to `.next/` directory
- `node_modules/` contains dependencies
- `.env.local` contains local environment variables (gitignored)
- Use `.gitignore` to exclude: `node_modules/`, `.next/`, `.env.local`, `.DS_Store`

## Common Issues and Solutions

### Build Issues
- **Node.js version**: Ensure Node.js 18+ is installed
- **Dependency issues**: Delete `node_modules` and `package-lock.json`, then run `npm install`
- **TypeScript errors**: Run `npm run build` to see detailed type checking
- **Next.js cache**: Delete `.next` directory and rebuild

### Runtime Issues  
- **OpenAI API errors**: Verify API key is valid and has credits
- **Rate limiting**: Wait 60 seconds between rate limit hits
- **Streaming issues**: Ensure hosting platform supports Server-Sent Events
- **CORS errors**: Set `ALLOWED_ORIGIN` environment variable correctly

### Development Workflow Issues
- **Port conflicts**: Next.js uses port 3000 by default
- **Hot reloading**: Restart dev server if hot reloading stops working
- **Environment variables**: Changes to .env.local require server restart

## Deployment Notes

### Vercel (Recommended)
- Set root directory to `apps/edu-tutor` in Vercel dashboard
- Configure all environment variables from `.env.example`
- Node.js 18+ runtime required
- Automatic builds on git push

### Other Platforms
- Works with any platform supporting Next.js
- Ensure correct build directory configuration
- Set environment variables for production
- Node.js 18+ runtime requirement

## Security and Performance

### API Security
- Never expose OpenAI API keys client-side
- Content moderation runs on all user input
- Rate limiting: 60 requests/minute/IP
- Input validation: 1500 character limit on messages
- No conversation data stored/logged (privacy-focused)

### Performance Characteristics  
- Streaming responses for real-time user experience
- Server-Sent Events (SSE) for smooth streaming
- Optimized bundle size with minimal client-side JavaScript
- Fast build times (~18 seconds) and quick development startup

### Cost Management
- Uses cost-effective gpt-4o-mini model by default
- Response token limits (~800 tokens) to control costs
- Input character limits (1500) to prevent abuse
- Rate limiting prevents excessive usage

---

**Critical Reminders:**
- NEVER CANCEL long-running commands - builds may take up to 60 seconds
- ALWAYS validate every command with proper timeouts before documenting
- ALWAYS test complete user scenarios after making changes
- ALWAYS run `npm run lint` before committing changes
- ALWAYS ensure OpenAI API key is configured for full functionality testing