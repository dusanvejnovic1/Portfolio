# Portfolio Repository with Educational Tutor App

Personal portfolio repository containing an AI-powered educational tutoring application in `apps/edu-tutor/`. The Educational Tutor provides hints-first learning experiences using Next.js 14, TypeScript, and OpenAI's GPT models.

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Working Effectively

### Prerequisites and Setup
- Ensure Node.js 18+ is installed (validated with Node.js 20.19.4)
- Repository requires npm for package management
- Educational Tutor app requires OpenAI API key for full functionality

### Bootstrap and Build Process
- Navigate to the edu-tutor application: `cd apps/edu-tutor`
- Install dependencies: `npm install` -- takes 60 seconds. NEVER CANCEL. Set timeout to 120+ seconds.
- Copy environment template: `cp .env.example .env.local`
- Edit `.env.local` and add your OpenAI API key: `OPENAI_API_KEY=your_key_here`
- Run linting: `npm run lint` -- takes 3 seconds. Always passes with current codebase.
- Build application: `npm run build` -- takes 20 seconds. NEVER CANCEL. Set timeout to 60+ seconds.

### Development and Testing
- Start development server: `npm run dev` -- ready in 2 seconds. Runs on http://localhost:3000
- Start production server: `npm run start` -- ready in 0.3 seconds (requires build first)
- NEVER CANCEL development or production servers during startup

### Validation Requirements
- ALWAYS run through complete end-to-end scenarios after making changes
- ALWAYS run `npm run lint` before committing changes or CI will fail
- Test the application UI by visiting http://localhost:3000
- Validate both hints mode and solution mode functionality
- Test the About page at http://localhost:3000/about
- Verify API endpoints work: `/api/chat` and `/api/moderate`

## Manual Testing Scenarios

### Critical User Scenarios to Test
- Load the main application and verify the UI renders correctly
- Enter an educational question in the textarea (e.g., "What is photosynthesis?")
- Test hints mode (toggle should be ON by default)
- Test solution mode (toggle hints mode OFF)
- Verify character counter shows 0/1500 and updates as you type
- Test the Send button functionality
- Check that export/copy session buttons appear after responses
- Navigate to About page and verify content loads
- Test rate limiting by making multiple rapid requests

### API Testing Commands
```bash
# Test moderation endpoint
curl -X POST http://localhost:3000/api/moderate \
  -H "Content-Type: application/json" \
  -d '{"input": "This is a test message"}'

# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2+2?", "mode": "hints"}'
```

## Repository Structure and Key Files

### Root Level
- `README.md` - Main repository documentation
- `PROJECT_BRIEF.md` - Detailed project specifications for edu-tutor
- `apps/edu-tutor/` - Self-contained Next.js educational tutoring application

### Educational Tutor App (`apps/edu-tutor/`)
- `app/` - Next.js App Router pages and API routes
  - `page.tsx` - Main chat interface
  - `about/page.tsx` - About page with app information
  - `api/chat/route.ts` - Streaming chat API with OpenAI integration
  - `api/moderate/route.ts` - Content moderation endpoint
- `components/` - React components
  - `Chat.tsx` - Main chat interface component
  - `Toggle.tsx` - Hints mode toggle component
- `lib/` - Utility functions
  - `openai.ts` - OpenAI client configuration
  - `prompts.ts` - System prompts for AI responses
  - `rateLimit.ts` - Rate limiting implementation
- `package.json` - Dependencies and build scripts
- `.env.example` - Environment variable template
- `README.md` - Detailed setup and deployment instructions

## Environment Configuration

### Required Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required) | - |
| `DEFAULT_MODEL` | Primary model for responses | `gpt-4o-mini` |
| `QUALITY_MODEL` | High-quality model option | `gpt-4o` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `60000` |
| `RATE_LIMIT_MAX` | Max requests per window | `60` |
| `ALLOWED_ORIGIN` | CORS allowed origin | `*` |

### Working Without OpenAI API Key
- Application runs and builds successfully without a valid API key
- Chat functionality returns moderation refusal messages
- All UI components and navigation work normally
- Use for testing UI changes and non-AI functionality

## Common Issues and Troubleshooting

### Build Issues
- If build fails, ensure Node.js 18+ is being used
- Clear `.next` folder and `node_modules`, then run `npm install` again
- Verify all environment variables are properly set in `.env.local`

### Runtime Issues
- **Rate Limit (429 errors)**: Wait 60 seconds and try again
- **CORS Errors**: Set `ALLOWED_ORIGIN` to your domain in production
- **OpenAI API Errors**: Verify API key is correct and has sufficient credits
- **Streaming Issues**: Ensure hosting platform supports Server-Sent Events

### Development Workflow
- Always work in the `apps/edu-tutor/` directory for the main application
- Run `npm run dev` for development with hot reload
- Use `npm run build && npm run start` to test production builds
- Monitor browser console for client-side errors
- Check server logs for API errors and rate limiting

## Technology Stack Details

- **Framework**: Next.js 14 with App Router and TypeScript
- **Styling**: Tailwind CSS with dark/light mode support
- **AI Integration**: OpenAI API with streaming responses
- **Rate Limiting**: In-memory implementation (60 requests/minute/IP)
- **Content Moderation**: OpenAI's omni-moderation-latest
- **Build System**: Next.js built-in build system
- **Deployment**: Vercel-ready configuration

## Key Features Implementation
- **Hints-First Learning**: Toggle between hints mode and solution mode
- **Real-time Streaming**: Server-Sent Events for smooth response delivery
- **Content Safety**: Automatic input moderation with polite refusals
- **Session Management**: Local export/copy functionality (no server storage)
- **Responsive Design**: Mobile-friendly with accessibility features
- **Privacy-Focused**: No user accounts, no conversation persistence

## Deployment Notes
- Application is designed for Vercel deployment
- Set root directory to `apps/edu-tutor` when deploying
- Configure all environment variables in the deployment platform
- Ensure Node.js 18+ runtime is selected
- Test streaming functionality on the deployment platform