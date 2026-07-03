import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

interface SaveConceptRequestBody {
  subject: string
  concept: string
  masteryLevel: string
  overviewGist: string
  deepDiveGist: string[]
  strongAreas: string[]
  weakAreas: string[]
  nextSteps: string[]
  notes: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SaveConceptRequestBody
    const subject = String(body?.subject || '').trim()
    const concept = String(body?.concept || '').trim()
    const masteryLevel = String(body?.masteryLevel || '').trim()
    const overviewGist = String(body?.overviewGist || '').trim()
    const deepDiveGist = Array.isArray(body?.deepDiveGist) ? body.deepDiveGist : []
    const strongAreas = Array.isArray(body?.strongAreas) ? body.strongAreas : []
    const weakAreas = Array.isArray(body?.weakAreas) ? body.weakAreas : []
    const nextSteps = Array.isArray(body?.nextSteps) ? body.nextSteps : []
    const notes = String(body?.notes || '').trim()

    if (!subject || !concept) {
      return NextResponse.json({ error: 'Missing subject or concept' }, { status: 400 })
    }

    const supabase = createClient()
    const { data, error } = await supabase
      .from('concepts')
      .upsert(
        {
          subject,
          concept,
          mastery_level: masteryLevel,
          overview_gist: overviewGist,
          deep_dive_gist: deepDiveGist,
          strong_areas: strongAreas,
          weak_areas: weakAreas,
          next_steps: nextSteps,
          notes,
          last_updated: new Date().toISOString(),
        },
        { onConflict: ['subject', 'concept'] }
      )
      .select()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
