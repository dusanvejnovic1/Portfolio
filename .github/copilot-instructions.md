# Portfolio Repository - GitHub Copilot Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Repository Overview
This is a personal portfolio repository that will contain a Next.js educational tutor web application. The repository is currently in its initial state with only documentation files (README.md, PROJECT_BRIEF.md, gitignore.txt).

## Working Effectively

### Environment Prerequisites
- Node.js v20.19.4 is available
- npm v10.8.2 is available  
- Git v2.50.1 is available
- Next.js 15.4.6 can be installed via create-next-app

### Bootstrap and Setup
When the Next.js application is added to this repository (planned under `apps/edu-tutor`), follow these steps:

1. **CRITICAL: Install dependencies first**
   - `cd apps/edu-tutor` (when the directory exists)
   - `npm install` -- takes 2-5 minutes depending on network. NEVER CANCEL. Set timeout to 10+ minutes.

2. **Build the application**
   - `npm run build` -- **NETWORK DEPENDENT**: Build may fail due to Google Fonts access restrictions in sandboxed environments. This is NORMAL and documented.
   - Expected error: "Failed to fetch `Geist` from Google Fonts" - this indicates network restrictions, not code issues.
   - Build time when successful: 1-3 minutes. NEVER CANCEL. Set timeout to 10+ minutes.

3. **Development server**
   - `npm run dev` -- starts development server on http://localhost:3000
   - Startup time: ~1 second with Turbopack
   - Server runs indefinitely until stopped
   - Use `timeout 30s npm run dev` for quick validation tests

4. **Linting**
   - `npm run lint` -- runs ESLint validation, takes 5-15 seconds
   - Always run before committing changes

### Application Structure (When Implemented)
Based on PROJECT_BRIEF.md, the Next.js app will have this structure:
```
apps/edu-tutor/
├── app/
│   ├── page.tsx              # Main chat UI
│   ├── about/page.tsx        # About page
│   └── api/
│       ├── chat/route.ts     # Streaming chat API
│       └── moderate/route.ts # Content moderation API
├── components/
│   ├── Chat.tsx             # Client streaming component
│   └── Toggle.tsx           # Hints mode toggle
├── lib/
│   ├── openai.ts            # OpenAI client (server-side)
│   ├── rateLimit.ts         # Rate limiting utilities
│   └── prompts.ts           # System prompts and policies
└── styles/
    └── globals.css          # Tailwind CSS
```

## Validation and Testing

### Manual Validation Scenarios
After making changes to the educational tutor app, ALWAYS test these scenarios:

1. **Basic Chat Flow**
   - Start development server: `npm run dev`
   - Navigate to http://localhost:3000
   - Enter a simple question like "What is 2+2?"
   - Verify streaming response appears
   - Test both "Hints mode" ON and OFF

2. **Hints vs Solution Mode**
   - Enable "Hints mode" toggle
   - Ask: "How do I solve x^2 + 5x + 6 = 0?"
   - Verify response gives 1-2 hints without full solution
   - Click "Show solution" 
   - Verify complete explanation appears

3. **Rate Limiting**
   - Send multiple rapid requests to test 60 req/min limit
   - Verify HTTP 429 response when exceeded

4. **Content Moderation**
   - Test inappropriate content to verify polite refusal
   - Verify educational redirection occurs

### Environment Variables Required
When implementing the application, these environment variables are needed:
```
OPENAI_API_KEY=
DEFAULT_MODEL=gpt-4o-mini
QUALITY_MODEL=gpt-4o
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=60
ALLOWED_ORIGIN=*
```

## Build and Deploy Timing Expectations

### Development Commands
- `npm install`: 2-5 minutes - NEVER CANCEL, set timeout to 10+ minutes
- `npm run dev`: ~1 second startup - can run indefinitely  
- `npm run lint`: 5-15 seconds
- `npm run build`: **NETWORK DEPENDENT** - may fail due to Google Fonts restrictions in sandboxed environments

### Known Limitations
- **CRITICAL**: Build failures due to Google Fonts (Geist, Geist Mono) are EXPECTED in restricted network environments
- This is NOT a code issue but a network access limitation
- Document this as "Build fails due to network restrictions accessing fonts.googleapis.com"

## Development Workflow

### Making Changes
1. Always run `npm run lint` before committing
2. Test the development server starts: `npm run dev`
3. **MANUAL VALIDATION REQUIRED**: Run through complete user scenarios listed above
4. Simply starting/stopping the app is NOT sufficient - test actual functionality

### Key Files to Monitor
- When modifying API contracts, always check corresponding client components
- API changes in `/app/api/chat/route.ts` should be validated in `Chat.tsx`
- Environment variable changes require updating `.env.example`
- Rate limiting changes in `lib/rateLimit.ts` need integration testing

## Common Tasks

### Current Repository State
```bash
ls -la
# Output:
drwxr-xr-x 3 runner docker 4096 .
drwxr-xr-x 3 runner docker 4096 ..
drwxr-xr-x 7 runner docker 4096 .git
-rw-r--r-- 1 runner docker 5839 PROJECT_BRIEF.md
-rw-r--r-- 1 runner docker  252 README.md
-rw-r--r-- 1 runner docker   81 gitignore.txt
```

### Package.json Scripts (When Available)
```json
"scripts": {
  "dev": "next dev --turbopack",
  "build": "next build", 
  "start": "next start",
  "lint": "next lint"
}
```

### Frequently Referenced Files
- `PROJECT_BRIEF.md` - Complete application specification and requirements
- `README.md` - Basic repository description  
- `gitignore.txt` - Node.js/Next.js ignore patterns (not yet renamed to .gitignore)

## Security Reminders
- NEVER expose OPENAI_API_KEY client-side
- All OpenAI calls must happen server-side only
- Rate limiting protects against abuse
- Content moderation prevents inappropriate usage
- No user data persistence in MVP version

## Troubleshooting
- If build fails with Google Fonts errors: This is expected in restricted networks
- If development server won't start: Check port 3000 availability  
- If API calls fail: Verify environment variables are set
- If rate limiting triggers unexpectedly: Check RATE_LIMIT_WINDOW_MS setting