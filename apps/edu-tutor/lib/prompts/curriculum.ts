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

When generating curriculum days, respond with NDJSON format (one JSON object per line) following this exact structure:

{"type": "day", "day": {"day": N, "title": "Day Title", "summary": "Brief summary", "goals": ["goal1", "goal2"], "theorySteps": ["step1", "step2"], "handsOnSteps": ["step1", "step2"], "resources": [{"title": "Resource Name", "url": "https://example.com", "type": "documentation"}], "assignment": "Assignment description", "checkForUnderstanding": ["question1", "question2"]}}

Generate one JSON object per day, then end with {"type": "done"} when complete.`
IMPORTANT: Only output JSON objects, one per line, as described. Do NOT include any extra text, explanation, greeting, or markdown.
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
