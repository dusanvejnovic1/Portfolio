/**
 * PDF export functionality using client-side libraries
 */

import { CurriculumPlan } from '../../types/modes'
import { exportCurriculumToMarkdown, markdownToHtml } from './markdown'

/**
 * Export curriculum plan to PDF using browser print
 */
export function exportCurriculumToPDF(plan: CurriculumPlan): void {
  const content = exportCurriculumToMarkdown(plan)
  const html = formatForPrint(content, plan.topic)
  
  // Create a new window with the content
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  
  if (!printWindow) {
    throw new Error('Failed to open print window. Please check popup blocker settings.')
  }
  
  printWindow.document.write(html)
  printWindow.document.close()
  
  // Wait for content to load, then print
  printWindow.onload = () => {
    printWindow.print()
    printWindow.onafterprint = () => {
      printWindow.close()
    }
  }
}

/**
 * Format content for PDF printing
 */
function formatForPrint(markdown: string, title: string): string {
  const htmlContent = markdownToHtml(markdown)
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - Educational Tutor</title>
  <style>
    @media print {
      @page {
        margin: 1in;
        size: letter;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: 12pt;
        line-height: 1.4;
        color: #000;
        background: #fff;
      }
      
      h1 {
        font-size: 24pt;
        margin-bottom: 20pt;
        page-break-after: avoid;
        border-bottom: 2pt solid #000;
        padding-bottom: 10pt;
      }
      
      h2 {
        font-size: 18pt;
        margin-top: 20pt;
        margin-bottom: 10pt;
        page-break-after: avoid;
      }
      
      h3 {
        font-size: 14pt;
        margin-top: 15pt;
        margin-bottom: 8pt;
        page-break-after: avoid;
      }
      
      p {
        margin-bottom: 8pt;
        text-align: justify;
      }
      
      ul, ol {
        margin-bottom: 10pt;
        padding-left: 20pt;
      }
      
      li {
        margin-bottom: 4pt;
      }
      
      a {
        color: #0066cc;
        text-decoration: underline;
      }
      
      strong {
        font-weight: bold;
      }
      
      em {
        font-style: italic;
      }
      
      hr {
        border: none;
        border-top: 1pt solid #ccc;
        margin: 15pt 0;
        page-break-after: avoid;
      }
      
      .day-section {
        page-break-inside: avoid;
        margin-bottom: 20pt;
      }
      
      .no-print {
        display: none;
      }
      
      .page-break {
        page-break-before: always;
      }
    }
    
    @media screen {
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        line-height: 1.6;
      }
      
      .print-button {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 14px;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      }
      
      .print-button:hover {
        background: #0056b3;
      }
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="content">
    ${htmlContent}
  </div>
  
  <script>
    // Auto-focus print dialog after a short delay
    setTimeout(() => {
      if (window.location.href.includes('_blank')) {
        window.print();
      }
    }, 500);
  </script>
</body>
</html>
  `.trim()
}

/**
 * Generate PDF filename for curriculum plan
 */
export function generatePDFFilename(plan: CurriculumPlan): string {
  const safeTitle = plan.topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
  
  const date = new Date().toISOString().split('T')[0]
  
  return `curriculum-${safeTitle}-${plan.level.toLowerCase()}-${date}.pdf`
}

/**
 * Create a print-optimized HTML version
 */
export function createPrintableHTML(plan: CurriculumPlan): string {
  const markdown = exportCurriculumToMarkdown(plan)
  return formatForPrint(markdown, `${plan.topic} - ${plan.level} Curriculum`)
}

/**
 * Export curriculum with custom PDF options
 */
export function exportCurriculumToPDFAdvanced(
  plan: CurriculumPlan,
  options: {
    includeTableOfContents?: boolean
    includeDailyPlans?: boolean
    pageBreakBetweenDays?: boolean
    fontSize?: 'small' | 'medium' | 'large'
  } = {}
): void {
  const {
    includeTableOfContents = true,
    includeDailyPlans = true,
    pageBreakBetweenDays = true,
    fontSize = 'medium'
  } = options
  
  let markdown = `# ${plan.topic} - ${plan.level} Level Curriculum\n\n`
  markdown += `**Duration:** ${plan.durationDays} days\n`
  markdown += `**Generated:** ${new Date().toLocaleDateString()}\n\n`
  
  if (includeTableOfContents) {
    markdown += '## Table of Contents\n\n'
    plan.outline.forEach((week, index) => {
      markdown += `${index + 1}. Week ${week.week}: ${week.focus}\n`
    })
    markdown += '\n'
    
    if (pageBreakBetweenDays) {
      markdown += '<div class="page-break"></div>\n\n'
    }
  }
  
  // Course Overview
  markdown += '## Course Overview\n\n'
  plan.outline.forEach(week => {
    markdown += `### Week ${week.week}: ${week.focus}\n`
    if (week.notes) {
      markdown += week.notes + '\n'
    }
    markdown += '\n'
  })
  
  if (includeDailyPlans && plan.days.length > 0) {
    if (pageBreakBetweenDays) {
      markdown += '<div class="page-break"></div>\n\n'
    }
    
    markdown += '## Detailed Daily Plans\n\n'
    
    plan.days.forEach((day, index) => {
      if (pageBreakBetweenDays && index > 0) {
        markdown += '<div class="page-break"></div>\n\n'
      }
      
      markdown += `<div class="day-section">\n\n`
      markdown += `### Day ${day.day}: ${day.title}\n\n`
      markdown += `**Summary:** ${day.summary}\n\n`
      
      if (day.goals.length > 0) {
        markdown += '**Learning Goals:**\n'
        day.goals.forEach(goal => {
          markdown += `- ${goal}\n`
        })
        markdown += '\n'
      }
      
      if (day.theorySteps.length > 0) {
        markdown += '**Theory:**\n'
        day.theorySteps.forEach((step, i) => {
          markdown += `${i + 1}. ${step}\n`
        })
        markdown += '\n'
      }
      
      if (day.handsOnSteps.length > 0) {
        markdown += '**Hands-on Practice:**\n'
        day.handsOnSteps.forEach((step, i) => {
          markdown += `${i + 1}. ${step}\n`
        })
        markdown += '\n'
      }
      
      if (day.resources.length > 0) {
        markdown += '**Resources:**\n'
        day.resources.forEach(resource => {
          const badge = resource.type.charAt(0).toUpperCase() + resource.type.slice(1)
          markdown += `- [${resource.title}](${resource.url}) *[${badge}]*\n`
        })
        markdown += '\n'
      }
      
      if (day.assignment) {
        markdown += '**Assignment:**\n'
        markdown += day.assignment + '\n\n'
      }
      
      if (day.checkForUnderstanding.length > 0) {
        markdown += '**Check for Understanding:**\n'
        day.checkForUnderstanding.forEach(question => {
          markdown += `- ${question}\n`
        })
        markdown += '\n'
      }
      
      markdown += '</div>\n\n'
    })
  }
  
  const html = formatForPrintAdvanced(markdown, plan.topic, fontSize)
  
  const printWindow = window.open('', '_blank', 'width=800,height=600')
  
  if (!printWindow) {
    throw new Error('Failed to open print window. Please check popup blocker settings.')
  }
  
  printWindow.document.write(html)
  printWindow.document.close()
  
  printWindow.onload = () => {
    printWindow.print()
    printWindow.onafterprint = () => {
      printWindow.close()
    }
  }
}

/**
 * Advanced formatting for PDF with custom options
 */
function formatForPrintAdvanced(
  markdown: string, 
  title: string, 
  fontSize: 'small' | 'medium' | 'large'
): string {
  const htmlContent = markdownToHtml(markdown)
  
  const fontSizes = {
    small: '10pt',
    medium: '12pt',
    large: '14pt'
  }
  
  const baseFontSize = fontSizes[fontSize]
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - Educational Tutor</title>
  <style>
    @media print {
      @page {
        margin: 0.75in;
        size: letter;
      }
      
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        font-size: ${baseFontSize};
        line-height: 1.4;
        color: #000;
        background: #fff;
      }
      
      h1 {
        font-size: calc(${baseFontSize} * 2);
        margin-bottom: 20pt;
        page-break-after: avoid;
        border-bottom: 2pt solid #000;
        padding-bottom: 10pt;
      }
      
      h2 {
        font-size: calc(${baseFontSize} * 1.5);
        margin-top: 20pt;
        margin-bottom: 10pt;
        page-break-after: avoid;
      }
      
      h3 {
        font-size: calc(${baseFontSize} * 1.2);
        margin-top: 15pt;
        margin-bottom: 8pt;
        page-break-after: avoid;
      }
      
      .day-section {
        page-break-inside: avoid;
        margin-bottom: 20pt;
        border-left: 3pt solid #007bff;
        padding-left: 15pt;
      }
      
      .page-break {
        page-break-before: always;
      }
      
      .no-print {
        display: none;
      }
      
      a {
        color: #0066cc;
      }
      
      ul, ol {
        margin-bottom: 10pt;
        padding-left: 20pt;
      }
    }
    
    @media screen {
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        max-width: 800px;
        margin: 0 auto;
        padding: 20px;
        line-height: 1.6;
      }
      
      .print-button {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 10px 20px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 1000;
      }
    }
  </style>
</head>
<body>
  <button class="print-button no-print" onclick="window.print()">Print / Save as PDF</button>
  <div class="content">
    ${htmlContent}
  </div>
</body>
</html>
  `.trim()
}

/**
 * Check browser PDF support
 */
export function checkPDFSupport(): {
  canPrint: boolean
  canSaveAsPDF: boolean
  recommendations: string[]
} {
  const recommendations: string[] = []
  
  // Check if browser supports printing
  const canPrint = typeof window.print === 'function'
  
  // Check if browser likely supports "Save as PDF"
  const isChrome = navigator.userAgent.includes('Chrome')
  const isFirefox = navigator.userAgent.includes('Firefox')
  const isSafari = navigator.userAgent.includes('Safari') && !isChrome
  const isEdge = navigator.userAgent.includes('Edge')
  
  const canSaveAsPDF = isChrome || isFirefox || isEdge
  
  if (!canPrint) {
    recommendations.push('Your browser may not support printing. Try a different browser.')
  }
  
  if (!canSaveAsPDF) {
    if (isSafari) {
      recommendations.push('In Safari, use File → Export as PDF from the print dialog')
    } else {
      recommendations.push('Use Chrome, Firefox, or Edge for best PDF export support')
    }
  }
  
  if (canSaveAsPDF) {
    recommendations.push('In the print dialog, choose "Save as PDF" as your destination')
  }
  
  return {
    canPrint,
    canSaveAsPDF,
    recommendations
  }
}