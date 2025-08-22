import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { openai, isGpt5 } from '@/lib/openai';
import { checkRateLimit } from '@/lib/rateLimit';
import { CurriculumGenerateRequestSchema } from '@/lib/schemas/curriculum';
import { curriculumSystemPrompt, curriculumUserPrompt } from '@/lib/prompts/curriculum';
import { acceptsSSE, createSSEHeaders } from '@/lib/sse';

export const runtime = 'nodejs';

type OpenAIClient = ReturnType<typeof openai>;

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  console.log('Curriculum generate request:', { requestId, timestamp: new Date().toISOString() });

  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const clientIP =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rateLimit = checkRateLimit(clientIP);
    if (!rateLimit.allowed) {
      console.log('Rate limit exceeded:', { requestId, ip: clientIP });
      return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = CurriculumGenerateRequestSchema.parse(body);

    console.log('Validated request:', { requestId, topic: parsed.topic, level: parsed.level, durationDays: parsed.durationDays });

    const useSSE = acceptsSSE(request);
    console.log('Response format:', { requestId, useSSE });

    const model = typeof body.model === 'string' ? body.model : process.env.DEFAULT_MODEL || 'gpt-4o-mini';
    console.log('Using model:', { requestId, model, requested: body.model });

    const client = openai();

    if (useSSE) {
      return createSSEResponse(client, model, parsed, request, requestId);
    }
    return createJSONResponse(client, model, parsed, requestId);

  } catch (error) {
    console.error('Curriculum generate error:', { requestId, error: error instanceof Error ? error.message : String(error) });

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request format', details: error.errors }, { status: 400 });
    }

    if (error instanceof Error) {
      if (error.message.includes('API key') || error.message.includes('Incorrect API key') || error.message.includes('invalid_api_key')) {
        return NextResponse.json({ error: 'Invalid OpenAI API key. Please check your API key configuration.' }, { status: 401 });
      }
      if (error.message.includes('model') || error.message.includes('Model')) {
        return NextResponse.json({ error: `Model configuration error. Please verify the model is available for your API key.` }, { status: 400 });
      }
      if (error.message.includes('rate limit') || error.message.includes('429')) {
        return NextResponse.json({ error: 'OpenAI rate limit reached. Please try again in a moment.' }, { status: 429 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function createSSEResponse(
  client: OpenAIClient,
  model: string,
  request: z.infer<typeof CurriculumGenerateRequestSchema>,
  httpRequest: NextRequest,
  requestId: string
) {
  const headers = createSSEHeaders(
    httpRequest.headers.get('origin') || undefined,
    process.env.ALLOWED_ORIGIN
  );

  const encoder = new TextEncoder();

  const readableStream = new ReadableStream({
    async start(controller) {
      try {
        const generatedDays: CurriculumDayContent[] = [];

        for (let dayIndex = 1; dayIndex <= request.durationDays; dayIndex++) {
          try {
            const dayContent = await generateSingleDay(
              client,
              model,
              request.topic,
              request.level,
              dayIndex,
              request.durationDays,
              request.goals
            );

            if (dayContent) {
              generatedDays.push(dayContent);

              const dayEvent = {
                type: 'day',
                day: dayContent,
                content: dayContent,
                index: dayIndex,
                title: dayContent.title,
                totalDays: request.durationDays
              };

              const eventLine = JSON.stringify(dayEvent) + '\n';
              controller.enqueue(encoder.encode(eventLine));

              console.log('Generated day:', { requestId, day: dayIndex, title: dayContent.title });
            }
          } catch (dayError) {
            console.error('Day generation failed:', { requestId, day: dayIndex, error: dayError });

            if (
              dayError instanceof Error &&
              (dayError.message.includes('Connection error') ||
                dayError.message.includes('ENOTFOUND') ||
                dayError.message.includes('getaddrinfo'))
            ) {
              const mockDay: CurriculumDayContent = {
                day: dayIndex,
                title: `Day ${dayIndex}: Demo Content - ${request.topic}`,
                summary: `This is demo content for Day ${dayIndex}. In a real deployment with proper OpenAI API access, this would contain comprehensive learning material for "${request.topic}" at ${request.level} level.`,
                goals: [
                  `Understanding core concepts for day ${dayIndex}`,
                  `Practical application of ${request.topic}`,
                  `Building on previous knowledge`
                ],
                theorySteps: [
                  `Review fundamental concepts`,
                  `Explore new theoretical frameworks`,
                  `Connect theory to practice`
                ],
                handsOnSteps: [
                  `Complete practical exercises`,
                  `Apply concepts in real scenarios`,
                  `Build sample projects`
                ],
                resources: [
                  {
                    title: 'Demo Documentation',
                    url: 'https://example.com/docs',
                    type: 'documentation'
                  }
                ],
                assignment: `Practice assignment for ${request.topic} - Day ${dayIndex} focus`,
                checkForUnderstanding: [
                  `Can you explain the main concepts?`,
                  `How would you apply this knowledge?`,
                  `What challenges did you encounter?`
                ]
              };

              generatedDays.push(mockDay);

              const dayEvent = {
                type: 'day',
                day: mockDay,
                content: mockDay,
                index: dayIndex,
                title: mockDay.title,
                totalDays: request.durationDays
              };

              const eventLine = JSON.stringify(dayEvent) + '\n';
              controller.enqueue(encoder.encode(eventLine));

              console.log('Generated mock day:', { requestId, day: dayIndex, title: mockDay.title });
            } else {
              const errorEvent = {
                type: 'error',
                error: `Failed to generate day ${dayIndex}: ${dayError instanceof Error ? dayError.message : String(dayError)}`
              };

              const errorLine = JSON.stringify(errorEvent) + '\n';
              controller.enqueue(encoder.encode(errorLine));
              controller.close();
              return;
            }
          }
        }

        const doneEvent = {
          type: 'done',
          totalGenerated: generatedDays.length
        };

        const doneLine = JSON.stringify(doneEvent) + '\n';
        controller.enqueue(encoder.encode(doneLine));
        controller.close();

        console.log('Curriculum generation completed:', { requestId, totalDays: generatedDays.length });

      } catch (error) {
        console.error('SSE streaming error:', { requestId, error });

        const errorEvent = {
          type: 'error',
          error: 'Generation failed. Please try again.'
        };

        const errorLine = JSON.stringify(errorEvent) + '\n';
        controller.enqueue(encoder.encode(errorLine));
        controller.close();
      }
    }
  });

  return new NextResponse(readableStream, { headers });
}

async function createJSONResponse(
  client: OpenAIClient,
  model: string,
  request: z.infer<typeof CurriculumGenerateRequestSchema>,
  requestId: string
) {
  try {
    const generatedDays: CurriculumDayContent[] = [];

    for (let dayIndex = 1; dayIndex <= request.durationDays; dayIndex++) {
      const dayContent = await generateSingleDay(
        client,
        model,
        request.topic,
        request.level,
        dayIndex,
        request.durationDays,
        request.goals
      );

      if (dayContent) {
        generatedDays.push(dayContent);
        console.log('Generated day:', { requestId, day: dayIndex, title: dayContent.title });
      }
    }

    return NextResponse.json({
      days: generatedDays,
      totalDays: request.durationDays
    });

  } catch (error) {
    console.error('JSON generation error:', { requestId, error });
    return NextResponse.json(
      { error: 'Generation failed. Please try again.' },
      { status: 500 }
    );
  }
}

interface CurriculumDayContent {
  day: number;
  title: string;
  summary: string;
  goals: string[];
  theorySteps: string[];
  handsOnSteps: string[];
  resources: Array<{
    title: string;
    url: string;
    type: 'documentation' | 'video' | 'tutorial' | 'tool';
  }>;
  assignment: string;
  checkForUnderstanding: string[];
}

function extractFirstJsonObject(text: string): string | null {
  // Remove markdown code fences if present
  const cleaned = text.replace(/```json([\s\S]*?)```/g, '$1').replace(/```([\s\S]*?)```/g, '$1');
  const match = cleaned.match(/{[\s\S]*}/);
  return match ? match[0] : null;
}

async function generateSingleDay(
  client: OpenAIClient,
  model: string,
  topic: string,
  level: 'Beginner' | 'Intermediate' | 'Advanced',
  dayIndex: number,
  totalDays: number,
  goals?: string[]
): Promise<CurriculumDayContent> {
  const systemPrompt = curriculumSystemPrompt();
  const userPrompt = `Generate day ${dayIndex} of ${totalDays} for the curriculum.

${curriculumUserPrompt(topic, level, totalDays, goals)}

Focus specifically on Day ${dayIndex}. Respond with a single JSON object following this exact format:

{
  "day": ${dayIndex},
  "title": "Day ${dayIndex} Title",
  "summary": "Brief summary of what students will learn",
  "goals": ["learning goal 1", "learning goal 2"],
  "theorySteps": ["theory step 1", "theory step 2"],
  "handsOnSteps": ["hands-on step 1", "hands-on step 2"],
  "resources": [{"title": "Resource Name", "url": "https://example.com", "type": "documentation"}],
  "assignment": "Practical assignment description",
  "checkForUnderstanding": ["check question 1", "check question 2"]
}

Only return the JSON object, no additional text.`;

  const effectiveModel = model;

  try {
    let completion;
    if (isGpt5(effectiveModel) && client.responses && client.responses.create) {
      completion = await client.responses.create({
        model: effectiveModel,
        input: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
        // Optionally: reasoning: { effort: 'high' },
      });
    } else {
      completion = await client.chat.completions.create({
        model: effectiveModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.3
      });
    }

    let response: string | undefined;

    if ('choices' in completion && completion.choices?.[0]?.message?.content) {
      response = completion.choices[0].message.content.trim();
    } else if ('output' in completion && Array.isArray(completion.output)) {
      for (const item of completion.output) {
        if (item.type === 'message' && item.content) {
          for (const content of item.content) {
            if (content.type === 'output_text' && content.text) {
              response = content.text.trim();
              break;
            }
          }
        }
      }
    }

    if (!response) {
      throw new Error('No response from OpenAI');
    }

    const jsonString = extractFirstJsonObject(response);
    if (!jsonString) {
      console.error('No JSON object found in OpenAI response:', response);
      throw new Error('Invalid JSON response from OpenAI');
    }

    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.day || !parsed.title || !parsed.summary) {
        throw new Error('Invalid day structure returned from OpenAI');
      }
      return parsed;
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', { response, error: parseError });
      throw new Error('Invalid JSON response from OpenAI');
    }

  } catch (error) {
    throw error instanceof Error ? error : new Error(String(error));
  }
}
