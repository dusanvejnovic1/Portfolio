#!/usr/bin/env node

/**
 * OpenAI Connectivity Diagnostic Script
 * 
 * This script performs a minimal test of OpenAI API connectivity.
 * It's designed to be used in CI/CD environments to verify API access
 * without exposing sensitive data.
 * 
 * Usage:
 *   OPENAI_API_KEY=your_key node scripts/openai-diagnostic.mjs
 *   MODEL=gpt-4o-mini OPENAI_API_KEY=your_key node scripts/openai-diagnostic.mjs
 */

import https from 'https';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'gpt-4o-mini';
const MODEL = process.env.MODEL || DEFAULT_MODEL;

// Helper to detect if a model is GPT-5
function isGpt5(model) {
  return /^gpt-5/.test(model);
}

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  console.error('Please set OPENAI_API_KEY as an environment variable');
  process.exit(1);
}

console.log(`🔍 Testing OpenAI API connectivity with model: ${MODEL}`);
if (MODEL !== DEFAULT_MODEL) {
  console.log(`📝 Using custom model (DEFAULT_MODEL: ${DEFAULT_MODEL})`);
}

const startTime = Date.now();
const isGpt5Model = isGpt5(MODEL);
const endpoint = isGpt5Model ? 'responses' : 'chat.completions';
const apiPath = isGpt5Model ? '/v1/responses' : '/v1/chat/completions';

console.log(`🔗 Using ${endpoint} API (${apiPath})`);
if (isGpt5Model) {
  console.log('⚠️ GPT-5 detected but using Chat Completions API as fallback. Responses API implementation pending.');
}

const postData = JSON.stringify({
  model: MODEL,
  messages: [
    { role: 'user', content: 'Say \'pong\'.' }
  ],
  max_tokens: 5
});

const options = {
  hostname: 'api.openai.com',
  port: 443,
  path: '/v1/chat/completions', // Use Chat Completions for now, even for GPT-5
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  const latency = Math.round((Date.now() - startTime) / 1000);
  
  console.log(`📊 Response status: ${res.statusCode}`);
  console.log(`⏱️ Latency: ${latency}s`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const response = JSON.parse(data);
        let messageContent;
        
        if (isGpt5Model) {
          // For GPT-5 (currently using Chat Completions as fallback)
          messageContent = response.choices?.[0]?.message?.content;
        } else {
          // For Chat Completions API
          messageContent = response.choices?.[0]?.message?.content;
        }
        
        if (messageContent) {
          console.log(`✅ event=openai_diagnostic_ok status=${res.statusCode} model=${MODEL} endpoint=${endpoint} latency=${latency}s`);
          console.log(`{ "ok": true, "model": "${MODEL}", "endpoint": "${endpoint}", "status": ${res.statusCode} }`);
          console.log('🎉 OpenAI API connectivity test passed!');
          process.exit(0);
        } else {
          console.log('⚠️ API responded with 2xx but message content missing or invalid');
          console.log('Response structure may be unexpected');
          process.exit(1);
        }
      } catch (error) {
        console.log('❌ Failed to parse API response as JSON');
        console.log('Response may be malformed');
        process.exit(1);
      }
    } else {
      console.log(`❌ event=openai_diagnostic_failed status=${res.statusCode} model=${MODEL} endpoint=${endpoint} latency=${latency}s`);
      console.log(`{ "ok": false, "model": "${MODEL}", "endpoint": "${endpoint}", "status": ${res.statusCode} }`);
      
      try {
        const errorResponse = JSON.parse(data);
        const errorType = errorResponse.error?.type || 'unknown';
        const errorCode = errorResponse.error?.code || 'unknown';
        
        console.log(`Error type: ${errorType}`);
        console.log(`Error code: ${errorCode}`);
      } catch (error) {
        console.log('Unable to parse error response');
      }
      
      console.log('Please check your OPENAI_API_KEY and OpenAI account status');
      process.exit(1);
    }
  });
});

req.on('error', (error) => {
  const latency = Math.round((Date.now() - startTime) / 1000);
  console.log(`❌ event=openai_diagnostic_failed status=network_error model=${MODEL} endpoint=${endpoint} latency=${latency}s`);
  console.log(`{ "ok": false, "model": "${MODEL}", "endpoint": "${endpoint}", "status": "network_error" }`);
  console.log(`Network error: ${error.message}`);
  process.exit(1);
});

req.write(postData);
req.end();