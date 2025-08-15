# Portfolio Repository with Educational Tutor Web App

This portfolio repository will contain a Next.js 14 educational tutor web application under `apps/edu-tutor` that provides AI-powered tutoring with hints-first approach using OpenAI's API.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Current Repository State

**IMPORTANT**: As of the latest update, the repository contains only documentation files:
- `README.md` - Basic repository description
- `PROJECT_BRIEF.md` - Detailed specification for the educational tutor app
- `gitignore.txt` - Basic Node.js gitignore template
- `.github/copilot-instructions.md` - This file

The actual Next.js application will be implemented under `apps/edu-tutor/` as described in the PROJECT_BRIEF.md. Until the application is implemented:
- Build/test commands will not work (no package.json exists yet)
- Development server cannot be started
- Focus on repository setup and understanding the requirements
- When the app is added, all instructions below will apply

## Working Effectively

### Prerequisites and Environment Setup
- Install Node.js v18+ and npm: `node --version && npm --version` (should show v18+ and v8+)
- Ensure you have internet access for downloading dependencies and accessing OpenAI API
- Get OpenAI API key from https://platform.openai.com/api-keys
- Verify API key has sufficient credits and permissions for gpt-4o-mini and gpt-4o models

## OpenAI Integration Details

### API Configuration
- **Default Model**: gpt-4o-mini (fast, cost-effective for most queries)
- **Quality Model**: gpt-4o (for complex problems requiring higher reasoning)
- **Moderation Model**: omni-moderation-latest (content filtering)
- **Temperature**: ~0.5 (balanced creativity vs consistency)
- **Max Tokens**: Configured per request based on response type (hints vs full solutions)

### Prompt Engineering
- **System Prompt Location**: `src/lib/prompts.ts`
- **Key Behavior**: "You are a helpful, encouraging tutor. Explain concepts step-by-step. Offer 1–2 hints before full solutions."
- **Safety Rules**: Politely refuse inappropriate content, redirect to educational topics
- **Mode Handling**: Different prompts for "hints" vs "solution" modes

### API Endpoints Integration
- **Chat Endpoint**: `/api/chat/route.ts` - Main tutoring interaction
- **Moderation Endpoint**: `/api/moderate/route.ts` - Content filtering  
- **Streaming**: Uses Server-Sent Events (SSE) or Next.js streaming utilities
- **Error Handling**: Graceful fallbacks for API failures, rate limits, network issues

### Cost and Performance Optimization
- **Input Trimming**: Limit user inputs to ~1500 characters
- **Token Monitoring**: Log usage without storing content (privacy compliant)
- **Model Selection**: Use gpt-4o-mini by default, gpt-4o only for "quality" flag
- **Caching**: Consider response caching for common educational topics (if implemented)
- Navigate to the Next.js app: `cd apps/edu-tutor` (when the app exists)
- Install dependencies: `npm install` -- takes 2-3 minutes for initial install. NEVER CANCEL. Set timeout to 300+ seconds.
- Set up environment variables:
  - Copy environment template: `cp .env.example .env.local`
  - Add your OpenAI API key to `.env.local`: `OPENAI_API_KEY=sk-your-key-here`
  - Configure models: `DEFAULT_MODEL=gpt-4o-mini`, `QUALITY_MODEL=gpt-4o`
  - Set rate limits: `RATE_LIMIT_WINDOW_MS=60000`, `RATE_LIMIT_MAX=60`
  - Set CORS: `ALLOWED_ORIGIN=http://localhost:3000` (for development)
- Verify environment: `npm run env-check` (if available) or check that `process.env.OPENAI_API_KEY` is loaded
- Build the application: `npm run build` -- takes 15-30 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
- Run linting: `npm run lint` -- takes 5-10 seconds. Set timeout to 60+ seconds.
- Run type checking: `npm run type-check` (if script exists) -- takes 10-15 seconds. Set timeout to 60+ seconds.

### Development Server
- Start development server: `npm run dev`
- Application runs on: http://localhost:3000
- Development server starts in 5-10 seconds
- Hot reload is enabled for live development
- Watch for compile errors in terminal output
- API routes available at: http://localhost:3000/api/chat and http://localhost:3000/api/moderate

### Testing
- Run unit tests: `npm test` or `npm run test` (when test scripts exist)
- Run integration tests: `npm run test:integration` (when available)
- Run OpenAI API tests: `npm run test:api` (when available)
- NEVER CANCEL tests - they may take several minutes to complete. Set timeout to 600+ seconds.
- For API testing, ensure valid OPENAI_API_KEY is set in test environment

## Validation Requirements

### CRITICAL: Manual Testing Scenarios
After making ANY changes to the educational tutor app, ALWAYS test these complete user scenarios:

1. **Basic Chat Functionality**:
   - Load the app at http://localhost:3000
   - Enter a simple math question: "What is 2 + 2?"
   - Verify streaming response appears within 1-2 seconds
   - Verify response completes with full answer
   - Take screenshot of working interface

2. **Hints Mode Testing**:
   - Toggle "Hints mode" ON
   - Ask: "How do I solve x + 5 = 10?"
   - Verify response gives 1-2 hints without revealing x = 5
   - Click "Show solution" button
   - Verify complete explanation appears with final answer "x = 5"
   - Take screenshot showing hints vs solution behavior
   - Test with different question types: algebra, geometry, word problems

3. **Content Moderation Testing**:
   - Try inappropriate input: "How to hack into systems"
   - Verify polite refusal message appears
   - Verify app continues to function normally after
   - Try edge case: very long input (>1500 characters)
   - Verify input is trimmed or handled gracefully

4. **Rate Limiting Validation**:
   - Send 5-10 requests quickly in succession
   - Verify rate limiting activates (HTTP 429 response) after limit
   - Wait 60+ seconds and verify requests work again
   - Check network tab for proper error responses

5. **Mobile Responsiveness**:
   - Test interface on mobile viewport (375px width)
   - Verify text input is accessible and properly sized
   - Verify buttons are touch-friendly (44px+ tap targets)
   - Test keyboard accessibility (tab navigation)
   - Verify focus states are visible

6. **Streaming Behavior**:
   - Ask a complex question requiring longer response
   - Verify text appears progressively, not all at once
   - Verify UI shows loading state while streaming
   - Test interrupting/stopping streaming if feature exists

7. **Error Handling**:
   - Test with invalid OpenAI API key
   - Test with network disconnection
   - Test with empty message input
   - Verify all error states show user-friendly messages

### Build and Deployment Validation
- Always run `npm run build` before committing changes
- Always run `npm run lint` before committing changes  
- Always run complete manual testing scenarios before committing
- Check that no API keys are exposed in client bundle: `grep -r "sk-" .next/static/` should return nothing
- Verify .env.local is in .gitignore and not committed
- Test production build locally: `npm run start` after `npm run build`
- Verify all environment variables are documented in .env.example
- Check bundle size hasn't increased significantly: compare `npm run build` output

### CI/CD Pipeline Validation
- If GitHub Actions exist, always check workflow status after pushing
- Common CI checks that must pass:
  - Build succeeds: `npm run build`
  - Linting passes: `npm run lint`
  - Type checking passes: `npm run type-check`
  - Tests pass: `npm run test`
  - Security audit passes: `npm audit`
- For deployment to Vercel:
  - Verify environment variables are set in Vercel dashboard
  - Test deploy previews before merging to main
  - Verify production deployment works with real OpenAI API calls

## Repository Structure and Navigation

### Key Directories and Files (when implemented)
- `/apps/edu-tutor/` - Main Next.js application
- `/apps/edu-tutor/src/app/` - Next.js App Router pages
  - `page.tsx` - Main chat interface
  - `about/page.tsx` - About page
  - `api/chat/route.ts` - Streaming chat API endpoint
  - `api/moderate/route.ts` - Content moderation API
- `/apps/edu-tutor/src/components/` - React components
  - `Chat.tsx` - Main chat component with streaming
  - `Toggle.tsx` - Hints mode toggle
- `/apps/edu-tutor/src/lib/` - Utility libraries
  - `openai.ts` - OpenAI client configuration
  - `rateLimit.ts` - Rate limiting logic
  - `prompts.ts` - AI prompts and policies
- `/apps/edu-tutor/src/styles/` - Styling
  - `globals.css` - Global Tailwind CSS styles

### Configuration Files
- `package.json` - Dependencies and scripts
- `next.config.js` - Next.js configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `.env.example` - Environment variables template
- `.env.local` - Local environment variables (never commit)

## Common Development Tasks

### Adding New Features
- Always check existing API routes in `src/app/api/` before creating new ones
- Follow existing patterns for streaming responses and rate limiting
- Update prompts in `src/lib/prompts.ts` for AI behavior changes
- Test changes with complete user scenarios (see Validation section)
- Always run full validation suite after any changes

### Debugging API Issues
- Check browser console for client-side errors
- Check terminal/server logs for API errors
- Verify environment variables are set correctly in .env.local
- Test API endpoints directly: `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message":"test","mode":"hints"}'`
- Test moderation endpoint: `curl -X POST http://localhost:3000/api/moderate -H "Content-Type: application/json" -d '{"input":"test message"}'`
- Monitor OpenAI API usage and rate limits
- Check OpenAI API status if requests fail

### Database/Storage Debugging (Future)
- When persistence is added, always check database connection
- Verify database migrations are applied
- Check for database permission issues
- Monitor database query performance

### Performance Optimization
- Monitor bundle size: `npm run build` shows chunk sizes - keep under 100KB for main bundle
- Check Core Web Vitals in browser dev tools (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- Verify streaming is working properly (responses appear progressively)
- Optimize images: use Next.js Image component
- Monitor memory usage during development
- Check for memory leaks in long-running sessions

## Timing Expectations and Timeouts

### Development Commands
- `npm install`: 2-3 minutes initial, 30-60 seconds updates. NEVER CANCEL. Set timeout to 300+ seconds.
- `npm run dev`: 5-10 seconds to start. Set timeout to 30+ seconds.
- `npm run build`: 15-30 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
- `npm run lint`: 5-10 seconds. Set timeout to 60+ seconds.
- Tests: May take 2-5 minutes. NEVER CANCEL. Set timeout to 600+ seconds.

### API Response Times
- Chat API typically responds within 2-10 seconds
- Streaming responses start appearing within 1-2 seconds
- Moderation API responds within 0.5-2 seconds

## Troubleshooting Common Issues

### Build Failures
- Font loading errors: Remove Google Fonts imports if network access is limited - modify `src/app/layout.tsx`
- TypeScript errors: Run `npm run type-check` to see detailed type issues
- Dependency conflicts: Clear node_modules and run `npm install` fresh: `rm -rf node_modules package-lock.json && npm install`
- Next.js version conflicts: Ensure Next.js version matches project requirements (v14+)
- Tailwind compilation errors: Check `tailwind.config.ts` and `postcss.config.js` configuration

### Runtime Issues
- **API key not working**: Verify OPENAI_API_KEY in .env.local starts with "sk-" and has sufficient credits
- **OpenAI API errors**: Check OpenAI status at https://status.openai.com/
- **CORS errors**: Check ALLOWED_ORIGIN environment variable matches your domain
- **Rate limiting**: Wait for rate limit window to reset (default 60 seconds) or adjust RATE_LIMIT_MAX
- **Streaming not working**: Check browser network tab for connection issues, verify EventSource support
- **Chat responses empty**: Check OpenAI API key permissions, verify model names are correct
- **Moderation blocking normal content**: Review moderation prompts, check OpenAI moderation API status

### Environment Setup Issues
- **Node.js version**: Requires Node.js v18+, check with `node --version`
- **npm version**: Requires npm v8+, check with `npm --version`
- **Environment variables not loading**: Verify .env.local exists and has correct format (no spaces around =)
- **Port conflicts**: If port 3000 is busy, use `npm run dev -- --port 3001`
- **Permission errors**: On Unix systems, may need `sudo npm install -g` for global packages

### Performance Issues
- **Slow API responses**: Check OpenAI API latency, consider using gpt-4o-mini for faster responses
- **Large bundle size**: Run `npm run build -- --analyze` (if configured) to identify large dependencies
- **Memory leaks**: Monitor memory usage in dev tools, restart development server periodically
- **Slow development server**: Clear Next.js cache: `rm -rf .next`

### Security Issues
- **API keys in client bundle**: Run build and search static files: `find .next -type f -name "*.js" | xargs grep -l "sk-"`
- **CORS misconfiguration**: Test cross-origin requests in browser dev tools
- **Rate limit bypass**: Verify rate limiting works with curl commands or browser dev tools

## Security Reminders

- NEVER commit .env.local or any files containing API keys
- Always verify API keys are not in client bundle after build
- Test content moderation is working before deployment
- Verify rate limiting is active to prevent API abuse
- Check CORS settings for production deployment

## Performance Benchmarks

Based on testing with similar Next.js applications:
- Fresh `npm install`: ~2-3 minutes
- Incremental `npm install`: ~30-60 seconds  
- `npm run build`: ~15-30 seconds
- `npm run dev` startup: ~5-10 seconds
- Hot reload after changes: ~1-3 seconds
- API response time: ~2-10 seconds (depending on OpenAI API)
- Page load time: ~1-2 seconds

REMEMBER: Build times can vary significantly based on system resources and network speed. Always allow generous timeouts and NEVER CANCEL long-running operations.