/**
 * Markdown export functionality for curriculum plans
 */

import { CurriculumPlan, CurriculumDay } from '../../types/modes'

/**
 * Export curriculum plan to markdown format
 */
export function exportCurriculumToMarkdown(plan: CurriculumPlan): string {
  const markdown: string[] = []
  
  // Title and metadata
  markdown.push(`# ${plan.topic} - ${plan.level} Level Curriculum`)
  markdown.push('')
  markdown.push(`**Duration:** ${plan.durationDays} days`)
  markdown.push(`**Generated:** ${new Date().toLocaleDateString()}`)
  markdown.push('')
  
  // Table of Contents
  markdown.push('## Table of Contents')
  markdown.push('')
  plan.outline.forEach((week, index) => {
    markdown.push(`${index + 1}. [Week ${week.week}: ${week.focus}](#week-${week.week}-${week.focus.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')})`)
  })
  markdown.push('')
  
  // Course Overview
  markdown.push('## Course Overview')
  markdown.push('')
  plan.outline.forEach(week => {
    markdown.push(`### Week ${week.week}: ${week.focus}`)
    if (week.notes) {
      markdown.push(week.notes)
    }
    markdown.push('')
  })
  
  // Detailed Daily Plans
  markdown.push('## Detailed Daily Plans')
  markdown.push('')
  
  plan.days.forEach(day => {
    markdown.push(...formatCurriculumDay(day))
  })
  
  return markdown.join('\n')
}

/**
 * Format a single curriculum day to markdown
 */
export function formatCurriculumDay(day: CurriculumDay): string[] {
  const markdown: string[] = []
  
  markdown.push(`### Day ${day.day}: ${day.title}`)
  markdown.push('')
  
  // Summary
  markdown.push('**Summary:** ' + day.summary)
  markdown.push('')
  
  // Learning Goals
  if (day.goals.length > 0) {
    markdown.push('**Learning Goals:**')
    day.goals.forEach(goal => {
      markdown.push(`- ${goal}`)
    })
    markdown.push('')
  }
  
  // Theory Steps
  if (day.theorySteps.length > 0) {
    markdown.push('**Theory:**')
    day.theorySteps.forEach((step, index) => {
      markdown.push(`${index + 1}. ${step}`)
    })
    markdown.push('')
  }
  
  // Hands-on Steps
  if (day.handsOnSteps.length > 0) {
    markdown.push('**Hands-on Practice:**')
    day.handsOnSteps.forEach((step, index) => {
      markdown.push(`${index + 1}. ${step}`)
    })
    markdown.push('')
  }
  
  // Resources
  if (day.resources.length > 0) {
    markdown.push('**Resources:**')
    day.resources.forEach(resource => {
      const badge = resource.type.charAt(0).toUpperCase() + resource.type.slice(1)
      markdown.push(`- [${resource.title}](${resource.url}) *[${badge}]*`)
    })
    markdown.push('')
  }
  
  // Assignment
  if (day.assignment) {
    markdown.push('**Assignment:**')
    markdown.push(day.assignment)
    markdown.push('')
  }
  
  // Check for Understanding
  if (day.checkForUnderstanding.length > 0) {
    markdown.push('**Check for Understanding:**')
    day.checkForUnderstanding.forEach(question => {
      markdown.push(`- ${question}`)
    })
    markdown.push('')
  }
  
  markdown.push('---')
  markdown.push('')
  
  return markdown
}

/**
 * Export curriculum plan outline only
 */
export function exportCurriculumOutlineToMarkdown(plan: CurriculumPlan): string {
  const markdown: string[] = []
  
  markdown.push(`# ${plan.topic} - ${plan.level} Level Outline`)
  markdown.push('')
  markdown.push(`**Duration:** ${plan.durationDays} days`)
  markdown.push('')
  
  plan.outline.forEach(week => {
    markdown.push(`## Week ${week.week}: ${week.focus}`)
    if (week.notes) {
      markdown.push(week.notes)
    }
    markdown.push('')
  })
  
  return markdown.join('\n')
}

/**
 * Export specific days range to markdown
 */
export function exportCurriculumDaysToMarkdown(
  days: CurriculumDay[],
  title: string = 'Curriculum Days'
): string {
  const markdown: string[] = []
  
  markdown.push(`# ${title}`)
  markdown.push('')
  markdown.push(`**Generated:** ${new Date().toLocaleDateString()}`)
  markdown.push('')
  
  days.forEach(day => {
    markdown.push(...formatCurriculumDay(day))
  })
  
  return markdown.join('\n')
}

/**
 * Create a downloadable markdown file
 */
export function downloadMarkdownFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.md') ? filename : `${filename}.md`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  
  URL.revokeObjectURL(url)
}

/**
 * Generate filename for curriculum plan export
 */
export function generateCurriculumFilename(plan: CurriculumPlan): string {
  const safeTitle = plan.topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50)
  
  const date = new Date().toISOString().split('T')[0]
  
  return `curriculum-${safeTitle}-${plan.level.toLowerCase()}-${date}.md`
}

/**
 * Export and download curriculum plan
 */
export function exportAndDownloadCurriculum(plan: CurriculumPlan): void {
  const content = exportCurriculumToMarkdown(plan)
  const filename = generateCurriculumFilename(plan)
  downloadMarkdownFile(content, filename)
}

/**
 * Copy curriculum markdown to clipboard
 */
export async function copyCurriculumToClipboard(plan: CurriculumPlan): Promise<boolean> {
  try {
    const content = exportCurriculumToMarkdown(plan)
    await navigator.clipboard.writeText(content)
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    return false
  }
}

/**
 * Generate markdown table of contents for a plan
 */
export function generateTableOfContents(plan: CurriculumPlan): string {
  const toc: string[] = []
  
  toc.push('## Table of Contents')
  toc.push('')
  
  plan.outline.forEach((week, index) => {
    const anchor = `week-${week.week}-${week.focus.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
    toc.push(`${index + 1}. [Week ${week.week}: ${week.focus}](#${anchor})`)
  })
  
  if (plan.days.length > 0) {
    toc.push('')
    toc.push('### Daily Plans')
    plan.days.forEach(day => {
      const anchor = `day-${day.day}-${day.title.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')}`
      toc.push(`- [Day ${day.day}: ${day.title}](#${anchor})`)
    })
  }
  
  return toc.join('\n')
}

/**
 * Validate markdown content
 */
export function validateMarkdownContent(content: string): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check for minimum content
  if (content.length < 100) {
    errors.push('Content is too short')
  }
  
  // Check for basic structure
  if (!content.includes('#')) {
    warnings.push('No headers found')
  }
  
  // Check for broken links
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  let match
  while ((match = linkRegex.exec(content)) !== null) {
    const url = match[2]
    if (!url.startsWith('http') && !url.startsWith('#')) {
      warnings.push(`Potentially broken link: ${url}`)
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Estimate reading time for markdown content
 */
export function estimateReadingTime(content: string): number {
  // Average reading speed: 200 words per minute
  const wordsPerMinute = 200
  const wordCount = content.split(/\s+/).length
  return Math.ceil(wordCount / wordsPerMinute)
}

/**
 * Convert markdown to HTML (basic conversion)
 */
export function markdownToHtml(markdown: string): string {
  let html = markdown
  
  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>')
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>')
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>')
  
  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
  
  // Italic
  html = html.replace(/\*(.*?)\*/gim, '<em>$1</em>')
  
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>')
  
  // Lists
  html = html.replace(/^\- (.*$)/gim, '<li>$1</li>')
  html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
  
  // Numbered lists
  html = html.replace(/^\d+\. (.*$)/gim, '<li>$1</li>')
  
  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr>')
  
  // Line breaks
  html = html.replace(/\n\n/g, '</p><p>')
  html = '<p>' + html + '</p>'
  
  return html
}