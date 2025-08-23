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

IMPORTANT: Respond ONLY with NDJSON (one valid JSON object per line) using the following events. Do not include any text outside JSON lines.

Day event (emit one per generated day):
{"type":"day","day":{"day":1,"title":"Day 1: Topic Title","summary":"Brief summary","goals":["goal1","goal2"],"theorySteps":["step1","step2"],"handsOnSteps":["step1","step2"],"resources":[{"title":"Resource Name","url":"https://example.com","type":"documentation"}],"assignment":"Assignment description","checkForUnderstanding":["question1","question2"]}}

Optional progress event:
{"type":"progress","value":"Starting curriculum generation..."}

Done event (after the last day):
{"type":"done","totalGenerated":5}

Error event (if something goes wrong):
{"type":"error","error":"description of error"}

Rules:
- Exactly one JSON object per line (NDJSON)
- Use the exact field names shown above
- The day object MUST include: day, title, summary, goals, theorySteps, handsOnSteps, resources, assignment, checkForUnderstanding
- Do not wrap events in arrays or add extra characters/text around JSON lines`
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

  prompt += `\n\nGenerate each day sequentially with practical theory, hands-on exercises, and real resources. Keep each day focused and achievable. Structure content to build skills progressively from day 1 to day ${durationDays}.

CRITICAL: Respond ONLY with NDJSON events as specified in the system prompt. Do not include any explanatory text or markdown.`

  return prompt
}
