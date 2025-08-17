#!/usr/bin/env node
/**
 * Test GPT-5 model availability
 */
import OpenAI from 'openai'

const client = new OpenAI({ apiKey: 'sk-test-key' })

// Test responses API methods
console.log('Testing responses API...')
try {
  console.log('Responses API methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.responses)))
  console.log('Responses inputItems methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.responses.inputItems)))
} catch (error) {
  console.log('Error exploring responses API:', error.message)
}

// Try to see if we can get model information
console.log('\nTesting models API...')
try {
  console.log('Models API methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.models)))
} catch (error) {
  console.log('Error exploring models API:', error.message)
}