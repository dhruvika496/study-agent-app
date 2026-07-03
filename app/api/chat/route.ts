import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { createAnthropic } from '@ai-sdk/anthropic'
import { streamText, toTextStream } from 'ai'

interface ChatRequestBody {
  userMessage: string
  subject: string
  concept: string
}

interface ConceptRow {
  mastery_level: string
  weak_areas: string | null
  strong_areas: string | null
}

function buildSystemPrompt(row: ConceptRow | null, subject: string, concept: string) {
  const normalizedSubject = subject.trim() || 'the requested subject'
  const normalizedConcept = concept.trim() || 'the requested concept'
  const weak = row?.weak_areas?.trim() ? `Weak areas: ${row.weak_areas.trim()}.` : ''
  const strong = row?.strong_areas?.trim() ? `Strong areas: ${row.strong_areas.trim()}.` : ''
  const context = [weak, strong].filter(Boolean).join(' ')

  if (!row) {
    return `You are an educational AI tutor. The learner asked about ${normalizedSubject} / ${normalizedConcept}. Use Mode A: beginner friendly, analogy-first, and define all terms. ${context}`.trim()
  }

  const mastery = row.mastery_level
  if (mastery === 'Introduced' || mastery === 'Developing') {
    return `You are an educational AI tutor. The learner has some exposure to ${normalizedSubject} / ${normalizedConcept}. Use Mode B: reference prior knowledge, mention weak areas, and teach at a moderate pace. ${context}`.trim()
  }

  return `You are an educational AI tutor. The learner is skilled with ${normalizedSubject} / ${normalizedConcept}. Use Mode C: be technical, skip basics, and focus on nuance. ${context}`.trim()
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ChatRequestBody
    const userMessage = String(body?.userMessage || '')
    const subject = String(body?.subject || '')
    const concept = String(body?.concept || '')

    if (!userMessage) {
      return NextResponse.json({ error: 'Missing userMessage' }, { status: 400 })
    }

    let row: ConceptRow | null = null

    if (subject.trim() && concept.trim()) {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('concepts')
        .select('mastery_level,weak_areas,strong_areas')
        .eq('subject', subject.trim())
        .eq('concept', concept.trim())
        .maybeSingle()

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      if (data) {
        row = data as ConceptRow
      }
    }

    const systemPrompt = buildSystemPrompt(row, subject, concept)
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const result = await streamText({
      model: anthropic.chat('claude-sonnet-4-5'),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    const textStream = toTextStream({ stream: result.stream })
    return new NextResponse(textStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
