/**
 * Curriculum generation prompts and prompt builders
 */

export function curriculumSystemPrompt(): string {
  return `You are an expert IT curriculum designer. Create practical, hands-on learning experiences that focus on real-world applications and industry best practices. 

Key principles:
- Structure content for progressive skill building
- Include practical exercises and hands-on activities  
- Use official documentation and reputable sources
- Avoid fabricating URLs or resources
- Design for active learning with clear objectives
- Consider learner's environment and constraints

When generating curriculum days, respond with NDJSON format (one JSON object per line) following this exact event schema (each line is a single JSON object):

Day event (for each generated day) example:
{"type":"day","index":1,"title":"Day 1: Introduction to JavaScript","content":{"day":1,"title":"Day 1: Introduction to JavaScript","summary":"Brief summary","goals":["goal1","goal2"],"theorySteps":["step1","step2"],"handsOnSteps":["step1","step2"],"resources":[{"title":"Resource Name","url":"https://example.com","type":"documentation"}],"assignment":"Assignment description","checkForUnderstanding":["question1","question2"]},"totalDays":5}

- type: must be the literal string "day"
- index: sequential 1-based index for the event
- title: a short human-friendly title for the day
- content: the detailed day object (use the inner structure exactly as shown)
- totalDays: total number of days to be generated

After all day events, emit a single done event when finished:
{"type":"done","totalGenerated":5}

If an error occurs, emit:
{"type":"error","error":"description of error"}

Important:
- Emit exactly one JSON object per line (NDJSON). Do not wrap events in arrays or additional text.
- Do not include explanatory text or extra characters outside the JSON lines.
- Ensure each day's content follows the exact field names and types shown above.`
}

export function curriculumUserPrompt(
  topic: string, 
  level: 'Beginner' | 'Intermediate' | 'Advanced',
  durationDays: number,
  goals?: string[]
): string {
  let prompt = `Create a ${durationDays}-day IT curriculum for "${topic}" at ${level} level.

Topic: ${topic}
Skill Level: ${level}  
Duration: ${durationDays} days
Focus: Practical, hands-on learning with real-world applications`

  if (goals && goals.length > 0) {
    prompt += `\nSpecific Learning Goals:\n${goals.map(goal => `- ${goal}`).join('\n')}`
  }

  prompt += `\n\nGenerate each day sequentially with practical theory, hands-on exercises, and real resources. Keep each day focused and achievable. Structure content to build skills progressively from day 1 to day ${durationDays}.`

  return prompt
}
