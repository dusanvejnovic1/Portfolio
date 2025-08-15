import { testOpenAIConnection, validateEnvironment } from '@/lib/openai'

export const runtime = 'nodejs'

export async function GET() {
  const requestId = crypto.randomUUID()
  
  try {
    // First validate environment
    const envValidation = validateEnvironment()
    if (!envValidation.ok) {
      console.log('OpenAI diagnostic failed - environment validation', {
        event: 'diagnostic_openai_env_error',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        error: envValidation.error
      })
      
      return Response.json({
        ok: false,
        error: envValidation.error,
        code: 'config_error'
      }, { status: 500 })
    }
    
    // Test OpenAI connectivity
    const result = await testOpenAIConnection()
    
    if (result.ok) {
      console.log('OpenAI diagnostic successful', {
        event: 'diagnostic_openai_ok',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        model: result.model,
        latency: result.provider_latency_ms
      })
    } else {
      console.log('OpenAI diagnostic failed - provider error', {
        event: 'diagnostic_openai_error',
        request_id: requestId,
        timestamp: new Date().toISOString(),
        error: result.error,
        latency: result.provider_latency_ms
      })
    }
    
    return Response.json(result)
    
  } catch (error) {
    console.error('Diagnostics API error:', error, {
      request_id: requestId,
      timestamp: new Date().toISOString(),
    })
    
    return Response.json({
      ok: false,
      error: 'Diagnostic test failed',
      code: 'diagnostic_error'
    }, { status: 500 })
  }
}