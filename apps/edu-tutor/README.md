# Educational Tutor

An AI-powered educational assistant that provides hints-first learning experiences. Built with Next.js 14, TypeScript, and OpenAI's GPT models.

## Features

- **Hints-First Learning**: Toggle between hints mode (1-2 guiding hints) and solution mode (complete explanations)
- **Model Selection**: Support for both GPT-4 and GPT-5 models with automatic API routing
- **Reasoning Controls**: Advanced reasoning options for GPT-5 models (low, medium, high effort)
- **Real-time Streaming**: Server-Sent Events (SSE) for smooth, real-time response streaming
- **Content Moderation**: Automatic screening of user input using OpenAI's moderation API
- **Rate Limiting**: Fair usage enforcement (60 requests/minute/IP)
- **Responsive Design**: Mobile-friendly interface with accessibility features
- **Session Export**: Copy or download conversation history locally
- **No Data Storage**: Privacy-focused design with no conversation persistence

## Model Routing

The application supports both GPT-4 and GPT-5 model families with automatic API routing:

### Supported Models
- **gpt-4o-mini**: Fast, cost-effective model (Default)
- **gpt-4o**: Higher quality GPT-4 model
- **gpt-5-mini**: Next-generation reasoning model (Preview)
- **gpt-5**: Advanced reasoning and analysis (Preview)

### API Routing Logic
The app automatically routes requests to the appropriate OpenAI API based on the selected model:

- **GPT-4 family** (`gpt-4o-mini`, `gpt-4o`): Uses Chat Completions API (`/v1/chat/completions`)
- **GPT-5 family** (`gpt-5-mini`, `gpt-5`): Uses Responses API (`/v1/responses`) *(Currently fallback to Chat Completions)*

### Reasoning Controls
When GPT-5 models are selected, additional reasoning controls become available:
- **Low**: Basic reasoning for simple questions
- **Medium**: Balanced reasoning for most tasks (Default)  
- **High**: Deep reasoning for complex problems

### Usage Examples

#### Using Chat API with model selection:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Explain quantum computing",
    "mode": "hints",
    "model": "gpt-4o-mini"
  }'
```

#### Using GPT-5 with reasoning:
```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Solve this complex math problem",
    "mode": "solution", 
    "model": "gpt-5-mini",
    "reasoning": {"effort": "high"}
  }'
```

## Tech Stack

- **Framework**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS with dark/light mode support
- **Backend**: Next.js API Routes (Node.js runtime)
- **AI**: OpenAI API with model routing (GPT-4 and GPT-5 support)
- **Hosting**: Vercel-ready configuration

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key

### Installation

1. **Clone and navigate to the directory**
   ```bash
   cd apps/edu-tutor
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   DEFAULT_MODEL=gpt-4o-mini
   QUALITY_MODEL=gpt-4o
   RATE_LIMIT_WINDOW_MS=60000
   RATE_LIMIT_MAX=60
   ALLOWED_ORIGIN=*
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Building for Production

```bash
npm run build
npm start
```

## Deployment

### Vercel (Recommended)

1. **Connect your repository to Vercel**
   - Import your project in the [Vercel Dashboard](https://vercel.com)
   - Set the root directory to `apps/edu-tutor`

2. **Configure environment variables in Vercel**
   - Add all variables from `.env.example`
   - Set `OPENAI_API_KEY` to your actual API key
   - Configure other variables as needed

3. **Deploy**
   - Vercel will automatically build and deploy your app
   - The app will be available at your assigned Vercel URL

### Other Platforms

The app can be deployed to any platform that supports Next.js:
- Netlify
- Railway
- DigitalOcean App Platform
- AWS Amplify

Ensure you:
- Set the correct build directory (`apps/edu-tutor`)
- Configure all environment variables
- Use Node.js 18+ runtime

## API Endpoints

### POST `/api/chat`
Main chat endpoint with streaming responses.

**Request Body:**
```json
{
  "message": "What is photosynthesis?",
  "mode": "hints" // or "solution"
}
```

**Response:** Server-Sent Events stream with JSON objects:
```
data: {"delta": "Photosynthesis is..."}
data: {"delta": " the process..."}
data: {"done": true}
```

### GET `/api/diagnostics/openai`
Test OpenAI connectivity and configuration.

**Response:**
```json
{
  "ok": true,
  "model": "gpt-4o-mini", 
  "provider_latency_ms": 1247,
  "response_received": true
}
```

On failure:
```json
{
  "ok": false,
  "model": "gpt-4o-mini",
  "provider_latency_ms": 1439,
  "error": "Connection error.",
  "code": "config_error"
}
```

### POST `/api/moderate`
Content moderation endpoint (used internally).

**Request Body:**
```json
{
  "input": "User message to moderate"
}
```

**Response:**
```json
{
  "flagged": false,
  "categories": {...},
  "category_scores": {...}
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required) | - |
| `DEFAULT_MODEL` | Primary model for responses | `gpt-4o-mini` |
| `QUALITY_MODEL` | High-quality model option | `gpt-4o` |
| `VISION_MODEL` | Model for image analysis | `gpt-4o` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in milliseconds | `60000` |
| `RATE_LIMIT_MAX` | Max requests per window | `60` |
| `ALLOWED_ORIGIN` | CORS allowed origin | `*` |
| `NEXT_PUBLIC_FEATURE_DIAGNOSTICS` | Enable diagnostic features in UI | `false` |

### Model Selection

The app supports multiple AI models with automatic API routing:

**Available Models:**
- `gpt-4o-mini` - Fast, cost-effective (Default)
- `gpt-4o` - Higher quality GPT-4  
- `gpt-5-mini` - Next-gen reasoning (Preview)
- `gpt-5` - Advanced reasoning (Preview)

**Model Routing:**
- GPT-4 models use Chat Completions API
- GPT-5 models use Responses API (with reasoning support)
- Users can select models via the UI dropdown
- Default model can be set via `DEFAULT_MODEL` environment variable

## Cost and Safety Notes

### Cost Management
- Input messages are limited to 1,500 characters
- Responses are capped at ~800 tokens to keep costs reasonable
- Uses cost-effective `gpt-4o-mini` model by default
- Rate limiting prevents abuse

### Safety Features
- All user input is moderated using OpenAI's `omni-moderation-latest`
- Inappropriate content is filtered and politely refused
- System prompts enforce educational focus
- No conversation data is stored or logged

### Privacy
- No user accounts or authentication
- No conversation persistence
- Minimal logging (metadata only, no content)
- Users can export conversations locally

## Troubleshooting

### Quick Diagnosis

Run the diagnostic script to check OpenAI connectivity:
```bash
npm run diag:openai
```

Or test the diagnostics endpoint directly:
```bash
curl http://localhost:3000/api/diagnostics/openai
```

You can also test specific models:
```bash
MODEL=gpt-4o node scripts/openai-diagnostic.mjs
MODEL=gpt-5-mini node scripts/openai-diagnostic.mjs
```

Expected response when working:
```json
{
  "ok": true,
  "model": "gpt-4o-mini",
  "endpoint": "chat.completions",
  "provider_latency_ms": 1247,
  "response_received": true
}
```

For GPT-5 models (currently using fallback):
```json
{
  "ok": true,
  "model": "gpt-5-mini", 
  "endpoint": "responses (fallback to chat.completions)",
  "provider_latency_ms": 1350,
  "response_received": true
}
```

### Common Issues

**Chat always returns provider_error**
- Check that `OPENAI_API_KEY` is set and valid
- Verify you have OpenAI API credits remaining
- Test connectivity with `npm run diag:openai`
- Check OpenAI service status at https://status.openai.com

**Content incorrectly flagged as inappropriate**
- This should no longer happen after the fix
- Check server logs for `moderation_service_error` events
- If moderation service is down, requests should still proceed

**Rate Limit (429 errors)**
- Wait 60 seconds and try again
- Check if multiple users are sharing the same IP
- Consider implementing user-specific rate limiting for production

**Streaming Issues**
- Ensure your hosting platform supports Server-Sent Events
- Check for proxy/CDN configurations that might buffer responses
- Verify the client can handle `text/event-stream` responses

**CORS Errors**
- Set `ALLOWED_ORIGIN` to your domain in production
- Check that the API routes are accessible from your frontend

**Build Errors**
- Ensure Node.js 18+ is being used
- Clear `.next` folder and `node_modules`, then reinstall
- Check that all environment variables are properly set

### Development Tips

**Testing Locally**
```bash
# Test the chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2+2?", "mode": "hints"}'

# Test moderation
curl -X POST http://localhost:3000/api/moderate \
  -H "Content-Type: application/json" \
  -d '{"input": "This is a test message"}'
```

**Monitoring**
- Check browser console for client-side errors
- Monitor server logs for API errors and rate limiting
- Use Network tab to debug streaming issues

## Future Enhancements

This MVP provides a foundation for additional features:

- **Authentication**: User accounts and session persistence
- **Database**: Conversation history and user preferences  
- **Advanced Features**: Regenerate responses, subject-specific tutoring, progress tracking
- **Content Library**: Integration with educational content and curriculum
- **Teacher Dashboard**: Classroom management and student progress
- **Mobile App**: Native iOS/Android applications

## Contributing

This is a self-contained educational project. If you're extending it:

1. Follow the existing code structure
2. Maintain the focus on educational content
3. Preserve privacy and safety features
4. Test thoroughly with various input types
5. Update documentation for any API changes

## License

This project is for educational and portfolio purposes.

---

**Educational Tutor MVP** - Empowering learning through guided discovery 🎓