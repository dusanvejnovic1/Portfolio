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

/**
 * Creates a user prompt for generating specific days in a curriculum
 * Used for parallel/batched generation to prevent duplicates and scope each shard
 */
export function curriculumUserPromptForDays(
  topic: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced',
  days: number[],
  totalDays: number,
  goals?: string[]
): string {
  const daysList = days.join(', ')
  
  let prompt = `Generate EXACTLY these days for the curriculum: [${daysList}] and NO OTHER DAYS.

STRICT RULES:
- Emit each requested day ONCE only. Never repeat a day number.
- Do not emit any day not in [${daysList}].
- Output strictly NDJSON day events only.

Topic: ${topic}
Level: ${level}
Total curriculum length: ${totalDays} days
Days to generate in this batch: ${daysList}`

  if (goals && goals.length > 0) {
    prompt += `\nOverall Learning Goals:\n${goals.map(goal => `- ${goal}`).join('\n')}`
  }

  prompt += `\n\nFor each day in [${daysList}], generate progressive content that builds on previous days and prepares for subsequent days in the full ${totalDays}-day curriculum.

CRITICAL: 
- Respond ONLY with NDJSON day events for days [${daysList}]
- Do not include any explanatory text or markdown
- Each day event must have day number from [${daysList}] only`

  return prompt
}

/**
 * Creates a user prompt for generating a single specific day in a curriculum
 * Used for non-streaming individual day generation
 */
export function curriculumUserPromptForSingleDay(
  topic: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced',
  day: number,
  totalDays: number,
  goals?: string[]
): string {
  let prompt = `Generate EXACTLY Day ${day} for the curriculum and NO OTHER DAYS.

STRICT RULES:
- Generate only Day ${day} out of the total ${totalDays}-day curriculum
- Do not generate any other day numbers
- Return a single NDJSON day event or plain JSON day object
- Keep fields concise but comprehensive

Topic: ${topic}
Level: ${level}
Day to generate: ${day}
Total curriculum length: ${totalDays} days`

  if (goals && goals.length > 0) {
    prompt += `\nOverall Learning Goals:\n${goals.map(goal => `- ${goal}`).join('\n')}`
  }

  prompt += `\n\nGenerate Day ${day} content that fits progressively within the full ${totalDays}-day curriculum. This day should build on previous days (1-${day-1}) and prepare for subsequent days (${day+1}-${totalDays}).

CRITICAL: 
- Respond with a single day event for Day ${day} only
- Use either NDJSON format: {"type":"day","day":{...}} 
- Or plain JSON format: {"day":${day},"title":"...","summary":"...",...}
- Do not include any explanatory text or markdown`

  return prompt
}
