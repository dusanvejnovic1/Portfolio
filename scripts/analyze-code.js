#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const APP_DIR = path.join(__dirname, '..', 'apps', 'edu-tutor');
const REPORTS_DIR = path.join(__dirname, '..', 'reports');
const REPORT_FILE = path.join(REPORTS_DIR, 'code-analysis.md');

// Analysis patterns to look for
const ANALYSIS_PATTERNS = [
  {
    name: 'Health Route Check',
    description: 'Verify health endpoint exists at proper App Router location',
    check: () => {
      const healthRouteExists = fs.existsSync(path.join(APP_DIR, 'app', 'api', 'health', 'route.ts'));
      const strayHealthFile = fs.existsSync(path.join(APP_DIR, 'app', 'apps_edu-tutor_app_api_health_route_Version2.ts'));
      
      if (healthRouteExists && !strayHealthFile) {
        return { status: 'PASS', message: 'Health route properly configured' };
      } else if (!healthRouteExists && strayHealthFile) {
        return { status: 'FAIL', message: 'Health route missing, stray file found' };
      } else if (!healthRouteExists) {
        return { status: 'FAIL', message: 'Health route missing' };
      } else {
        return { status: 'WARN', message: 'Health route exists but stray file also present' };
      }
    }
  },
  {
    name: 'Moderation Retry Logic',
    description: 'Check if moderation has retry logic and safe fallback',
    check: () => {
      try {
        const openaiFile = fs.readFileSync(path.join(APP_DIR, 'lib', 'openai.ts'), 'utf8');
        const hasRetry = openaiFile.includes('maxAttempts') && openaiFile.includes('for (let attempt');
        const hasDelay = openaiFile.includes('async function delay') || openaiFile.includes('await delay');
        const hasSafeFallback = openaiFile.includes('flagged: false') && openaiFile.includes('moderation_failed');
        
        if (hasRetry && hasDelay && hasSafeFallback) {
          return { status: 'PASS', message: 'Moderation has retry logic and safe fallback' };
        } else {
          const missing = [];
          if (!hasRetry) missing.push('retry logic');
          if (!hasDelay) missing.push('exponential backoff');
          if (!hasSafeFallback) missing.push('safe fallback');
          return { status: 'FAIL', message: `Moderation missing: ${missing.join(', ')}` };
        }
      } catch (error) {
        return { status: 'ERROR', message: `Could not analyze openai.ts: ${error.message}` };
      }
    }
  },
  {
    name: 'CORS Implementation',
    description: 'Check if CORS headers are implemented in API routes',
    check: () => {
      try {
        const chatRoute = fs.readFileSync(path.join(APP_DIR, 'app', 'api', 'chat', 'route.ts'), 'utf8');
        const moderateRoute = fs.readFileSync(path.join(APP_DIR, 'app', 'api', 'moderate', 'route.ts'), 'utf8');
        
        const chatHasCORS = chatRoute.includes('getCORSHeaders') && chatRoute.includes('OPTIONS');
        const moderateHasCORS = moderateRoute.includes('getCORSHeaders') && moderateRoute.includes('OPTIONS');
        const usesAllowedOrigin = (chatRoute + moderateRoute).includes('ALLOWED_ORIGIN');
        
        if (chatHasCORS && moderateHasCORS && usesAllowedOrigin) {
          return { status: 'PASS', message: 'CORS properly implemented in both API routes' };
        } else {
          const missing = [];
          if (!chatHasCORS) missing.push('/api/chat');
          if (!moderateHasCORS) missing.push('/api/moderate');
          if (!usesAllowedOrigin) missing.push('ALLOWED_ORIGIN usage');
          return { status: 'FAIL', message: `CORS missing in: ${missing.join(', ')}` };
        }
      } catch (error) {
        return { status: 'ERROR', message: `Could not analyze API routes: ${error.message}` };
      }
    }
  },
  {
    name: 'Client IP Implementation',
    description: 'Check getClientIP helper for correct implementation',
    check: () => {
      try {
        const chatRoute = fs.readFileSync(path.join(APP_DIR, 'app', 'api', 'chat', 'route.ts'), 'utf8');
        
        // Check for the bug where x-forwarded-for is used twice
        const xForwardedForCount = (chatRoute.match(/x-forwarded-for/g) || []).length;
        const hasRobustFallback = chatRoute.includes('x-real-ip') && chatRoute.includes("return 'unknown'");
        const noDuplicateAssignment = !chatRoute.includes('socketRemoteAddress = request.headers.get(\'x-forwarded-for\')');
        
        if (hasRobustFallback && noDuplicateAssignment && xForwardedForCount <= 2) {
          return { status: 'PASS', message: 'Client IP helper correctly implemented' };
        } else {
          const issues = [];
          if (!hasRobustFallback) issues.push('missing robust fallback');
          if (!noDuplicateAssignment) issues.push('duplicate x-forwarded-for assignment');
          if (xForwardedForCount > 2) issues.push('excessive x-forwarded-for usage');
          return { status: 'FAIL', message: `Client IP issues: ${issues.join(', ')}` };
        }
      } catch (error) {
        return { status: 'ERROR', message: `Could not analyze getClientIP: ${error.message}` };
      }
    }
  },
  {
    name: 'SSE Headers',
    description: 'Check for proper SSE headers including X-Accel-Buffering',
    check: () => {
      try {
        const chatRoute = fs.readFileSync(path.join(APP_DIR, 'app', 'api', 'chat', 'route.ts'), 'utf8');
        
        const hasCharset = chatRoute.includes('text/event-stream; charset=utf-8');
        const hasBufferingHeader = chatRoute.includes('X-Accel-Buffering');
        const hasCacheControl = chatRoute.includes('no-cache, no-transform');
        
        if (hasCharset && hasBufferingHeader && hasCacheControl) {
          return { status: 'PASS', message: 'SSE headers properly hardened' };
        } else {
          const missing = [];
          if (!hasCharset) missing.push('charset in Content-Type');
          if (!hasBufferingHeader) missing.push('X-Accel-Buffering header');
          if (!hasCacheControl) missing.push('proper cache control');
          return { status: 'FAIL', message: `SSE headers missing: ${missing.join(', ')}` };
        }
      } catch (error) {
        return { status: 'ERROR', message: `Could not analyze SSE headers: ${error.message}` };
      }
    }
  },
  {
    name: 'Rate Limiter Interface',
    description: 'Check if rate limiter uses extensible interface pattern',
    check: () => {
      try {
        const rateLimitFile = fs.readFileSync(path.join(APP_DIR, 'lib', 'rateLimit.ts'), 'utf8');
        
        const hasInterface = rateLimitFile.includes('interface RateLimiter');
        const hasFactory = rateLimitFile.includes('createRateLimiter');
        const hasRedisComment = rateLimitFile.includes('Redis') && rateLimitFile.includes('TODO');
        
        if (hasInterface && hasFactory) {
          return { 
            status: 'PASS', 
            message: `Extensible rate limiter interface implemented${hasRedisComment ? ' with Redis TODO' : ''}` 
          };
        } else {
          const missing = [];
          if (!hasInterface) missing.push('RateLimiter interface');
          if (!hasFactory) missing.push('factory function');
          return { status: 'FAIL', message: `Rate limiter missing: ${missing.join(', ')}` };
        }
      } catch (error) {
        return { status: 'ERROR', message: `Could not analyze rate limiter: ${error.message}` };
      }
    }
  },
  {
    name: 'Input Validation with Zod',
    description: 'Check if zod schemas are used for input validation',
    check: () => {
      try {
        const validationFile = fs.existsSync(path.join(APP_DIR, 'lib', 'validation.ts'));
        
        if (!validationFile) {
          return { status: 'FAIL', message: 'validation.ts file not found' };
        }
        
        const validationContent = fs.readFileSync(path.join(APP_DIR, 'lib', 'validation.ts'), 'utf8');
        const chatRoute = fs.readFileSync(path.join(APP_DIR, 'app', 'api', 'chat', 'route.ts'), 'utf8');
        const moderateRoute = fs.readFileSync(path.join(APP_DIR, 'app', 'api', 'moderate', 'route.ts'), 'utf8');
        
        const hasSchemas = validationContent.includes('chatRequestSchema') && validationContent.includes('moderateRequestSchema');
        const chatUsesZod = chatRoute.includes('chatRequestSchema') && chatRoute.includes('safeParse');
        const moderateUsesZod = moderateRoute.includes('moderateRequestSchema') && moderateRoute.includes('safeParse');
        
        if (hasSchemas && chatUsesZod && moderateUsesZod) {
          return { status: 'PASS', message: 'Zod validation properly implemented in all routes' };
        } else {
          const missing = [];
          if (!hasSchemas) missing.push('validation schemas');
          if (!chatUsesZod) missing.push('/api/chat usage');
          if (!moderateUsesZod) missing.push('/api/moderate usage');
          return { status: 'FAIL', message: `Zod validation missing: ${missing.join(', ')}` };
        }
      } catch (error) {
        return { status: 'ERROR', message: `Could not analyze input validation: ${error.message}` };
      }
    }
  }
];

// Utility functions
function walkDir(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      // Skip node_modules, .next, .git
      if (!['node_modules', '.next', '.git', 'dist', 'out'].includes(file)) {
        walkDir(filePath, fileList);
      }
    } else {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

function generateReport(results) {
  const timestamp = new Date().toISOString();
  const summary = results.reduce((acc, result) => {
    acc[result.result.status] = (acc[result.result.status] || 0) + 1;
    return acc;
  }, {});

  let report = `# Code Analysis Report

**Generated:** ${timestamp}  
**Target:** \`apps/edu-tutor\` Next.js application  
**Analysis Patterns:** ${results.length}

## Summary

`;

  // Add summary stats
  Object.entries(summary).forEach(([status, count]) => {
    const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : status === 'WARN' ? '⚠️' : '🔍';
    report += `- ${emoji} **${status}:** ${count}\n`;
  });

  report += `\n## Detailed Results\n\n`;

  // Add detailed results
  results.forEach(({ pattern, result }) => {
    const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'WARN' ? '⚠️' : '🔍';
    report += `### ${emoji} ${pattern.name}\n\n`;
    report += `**Description:** ${pattern.description}\n\n`;
    report += `**Status:** ${result.status}\n\n`;
    report += `**Details:** ${result.message}\n\n`;
    report += `---\n\n`;
  });

  // Add recommendations
  const failedChecks = results.filter(r => r.result.status === 'FAIL');
  if (failedChecks.length > 0) {
    report += `## Recommendations\n\n`;
    failedChecks.forEach(({ pattern, result }) => {
      report += `- **${pattern.name}:** ${result.message}\n`;
    });
    report += `\n`;
  }

  report += `## Next Steps\n\n`;
  report += `1. Address any FAIL status items above\n`;
  report += `2. Review WARN status items for potential improvements\n`;
  report += `3. Re-run analysis after making changes\n\n`;
  
  report += `---\n\n`;
  report += `*This report was automatically generated by the code analysis workflow.*\n`;

  return report;
}

// Main execution
function main() {
  console.log('🔍 Starting code analysis for apps/edu-tutor...');
  
  if (!fs.existsSync(APP_DIR)) {
    console.error(`❌ Target directory not found: ${APP_DIR}`);
    process.exit(1);
  }

  // Run all analysis patterns
  const results = [];
  
  ANALYSIS_PATTERNS.forEach(pattern => {
    console.log(`📋 Running: ${pattern.name}`);
    try {
      const result = pattern.check();
      results.push({ pattern, result });
      
      const emoji = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : result.status === 'WARN' ? '⚠️' : '🔍';
      console.log(`   ${emoji} ${result.message}`);
    } catch (error) {
      console.error(`   🔍 ERROR: ${error.message}`);
      results.push({ 
        pattern, 
        result: { status: 'ERROR', message: `Analysis failed: ${error.message}` }
      });
    }
  });

  // Generate and write report
  console.log('\n📄 Generating report...');
  const report = generateReport(results);
  
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  
  fs.writeFileSync(REPORT_FILE, report, 'utf8');
  
  const summary = results.reduce((acc, result) => {
    acc[result.result.status] = (acc[result.result.status] || 0) + 1;
    return acc;
  }, {});
  
  console.log(`\n✅ Analysis complete!`);
  console.log(`📊 Results: ${Object.entries(summary).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
  console.log(`📝 Report saved to: ${REPORT_FILE}`);
  
  // Exit with error code if any checks failed
  if (summary.FAIL || summary.ERROR) {
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}