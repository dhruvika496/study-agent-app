import { NextResponse } from 'next/server'
import { createAnthropic } from '@ai-sdk/anthropic'
import { generateText } from 'ai'

interface DetectConceptRequestBody {
  userMessage: string
}

interface DetectConceptResponse {
  subject: string
  concept: string
}

const extractPrompt = `You are an assistant that extracts the study subject and concept from a learner's message.
Return only a JSON object with fields: subject (string) and concept (string).
If the message is not about studying a concept, return {"subject": "", "concept": ""}.
Do not include any explanations, markdown, or additional text.`

function parseJsonObject(text: string): DetectConceptResponse {
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { subject: '', concept: '' }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      concept: typeof parsed.concept === 'string' ? parsed.concept : '',
    }
  } catch {
    return { subject: '', concept: '' }
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as DetectConceptRequestBody
    const userMessage = String(body?.userMessage || '').trim()

    if (!userMessage) {
      return NextResponse.json({ error: 'Missing userMessage' }, { status: 400 })
    }

    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const result = await generateText({
      model: anthropic.chat('claude-sonnet-4-5'),
      system: extractPrompt,
      messages: [{ role: 'user', content: userMessage }],
      temperature: 0,
    })

    const response = parseJsonObject(result.text ?? '')
    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
