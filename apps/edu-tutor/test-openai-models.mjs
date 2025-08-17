#!/usr/bin/env node
/**
 * Test script to explore OpenAI SDK capabilities
 */
import OpenAI from 'openai'

console.log('OpenAI SDK version:', OpenAI.version || 'unknown')

// Check if we have the OpenAI client class
console.log('OpenAI client available:', typeof OpenAI)

// Test creating a client without API key to see available properties/methods
try {
  const client = new OpenAI({ apiKey: 'test-key' })
  
  console.log('\nAvailable client methods:')
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
  console.log(methods.filter(m => !m.startsWith('_')))
  
  console.log('\nClient properties:')
  console.log(Object.keys(client))
  
  // Check if completions API is available
  if (client.chat) {
    console.log('\nChat completions API available')
    console.log('Chat completions methods:', Object.keys(client.chat))
  }
  
  // Check for any potential responses API
  if (client.responses) {
    console.log('\nResponses API available!')
    console.log('Responses methods:', Object.keys(client.responses))
  } else {
    console.log('\nResponses API not found in client')
  }
  
  // List all available namespaces on the client
  console.log('\nAll client namespaces:')
  for (const key in client) {
    if (typeof client[key] === 'object' && client[key] !== null) {
      console.log(`- ${key}:`, Object.keys(client[key]))
    }
  }
  
} catch (error) {
  console.error('Error exploring client:', error.message)
}