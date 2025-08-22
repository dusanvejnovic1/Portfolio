import { testOpenAIConnection } from '@/lib/openai'
import { GoogleCSEProvider } from '@/lib/search/providers'

export const runtime = 'nodejs'

interface IntegrationStatus {
  ok: boolean
  error?: string
  latency?: number
  configured: boolean
}

interface IntegrationsHealthResponse {
  openai: IntegrationStatus
  google_cse: IntegrationStatus
}

export async function GET() {
  const requestId = crypto.randomUUID()
  console.log('Integrations health check started:', { requestId, timestamp: new Date().toISOString() })
  
  try {
    const results: IntegrationsHealthResponse = {
      openai: { ok: false, configured: false },
      google_cse: { ok: false, configured: false }
    }
    
    // Check OpenAI integration
    try {
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY
      results.openai.configured = hasOpenAIKey
      
      if (hasOpenAIKey) {
        const openaiResult = await testOpenAIConnection()
        results.openai.ok = openaiResult.ok
        results.openai.latency = openaiResult.provider_latency_ms
        if (!openaiResult.ok) {
          results.openai.error = openaiResult.error || 'OpenAI connection failed'
        }
      } else {
        results.openai.error = 'OPENAI_API_KEY not configured'
      }
    } catch (error) {
      results.openai.error = error instanceof Error ? error.message : 'OpenAI check failed'
    }
    
    // Check Google CSE integration
    try {
      const googleCSE = new GoogleCSEProvider()
      results.google_cse.configured = googleCSE.isConfigured()
      
      if (googleCSE.isConfigured()) {
        const cseResult = await googleCSE.testConnection()
        results.google_cse.ok = cseResult.ok
        results.google_cse.latency = cseResult.latency
        if (!cseResult.ok) {
          results.google_cse.error = cseResult.error || 'Google CSE connection failed'
        }
      } else {
        results.google_cse.error = 'GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX not configured'
      }
    } catch (error) {
      results.google_cse.error = error instanceof Error ? error.message : 'Google CSE check failed'
    }
    
    console.log('Integrations health check completed:', { 
      requestId,
      openai_ok: results.openai.ok,
      google_cse_ok: results.google_cse.ok,
      openai_configured: results.openai.configured,
      google_cse_configured: results.google_cse.configured
    })
    
    return Response.json(results)
    
  } catch (error) {
    console.error('Integrations health check error:', error, {
      event: 'diagnostic_integrations_error',
      request_id: requestId,
      timestamp: new Date().toISOString()
    })
    
    return Response.json({
      error: 'Health check failed',
      message: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}