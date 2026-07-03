import { createClient } from '@/lib/supabase'

interface ConceptRow {
  subject: string
  concept: string
  mastery_level: string
  overview_gist?: string | null
  deep_dive_gist?: string[] | string | null
  strong_areas?: string[] | string | null
  weak_areas?: string[] | string | null
  next_steps?: string[] | string | null
  last_updated?: string | null
}

const MASTERY_SCORES: Record<string, number> = {
  Strong: 4,
  Proficient: 3,
  Developing: 2,
  Introduced: 1,
  'In Progress': 0,
}

const subjectColors: Record<string, string> = {
  Physics: 'bg-blue-600 text-blue-100',
  Biology: 'bg-emerald-600 text-emerald-100',
  Mathematics: 'bg-violet-600 text-violet-100',
  'Computer Science': 'bg-orange-500 text-orange-100',
  Chemistry: 'bg-red-600 text-red-100',
}

function normalizeArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.filter(Boolean)
    } catch {
      return value
        .split(/[;,\n]/)
        .map((item) => item.trim())
        .filter(Boolean)
    }
  }
  return []
}

function formatDate(value?: string | null) {
  if (!value) return 'Unknown'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function getMasteryLabel(level: string) {
  if (!level) return 'In Progress'
  return level
}

function getProgressValue(level: string) {
  return MASTERY_SCORES[level] ?? 0
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('concepts')
    .select('*')
    .order('last_updated', { ascending: false })

  const concepts: ConceptRow[] = Array.isArray(data) ? data : []

  const total = concepts.length
  const subjectSet = new Set(concepts.map((item) => item.subject).filter(Boolean))
  const uniqueSubjects = subjectSet.size
  const totalScore = concepts.reduce((sum, item) => sum + getProgressValue(item.mastery_level), 0)
  const averageScore = total ? totalScore / total : 0
  const averagePercent = Math.round((averageScore / 4) * 100)

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl rounded-3xl border border-red-500 bg-slate-900/80 p-8 text-red-200">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-4">Unable to load concept data: {error.message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="text-lg font-semibold text-slate-100">Study Agent</div>
          <div className="flex gap-3 text-sm">
            <a href="/" className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 transition hover:border-slate-500 hover:bg-slate-800">
              Chat
            </a>
            <a href="/dashboard" className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-slate-100 transition hover:border-slate-500 hover:bg-slate-800">
              Dashboard
            </a>
          </div>
        </div>
      </nav>
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-sky-400/80">Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-50">Concept Study Overview</h1>
            </div>
            <div className="rounded-3xl bg-slate-800 px-4 py-3 text-sm text-slate-300 ring-1 ring-slate-700">
              {total} concepts tracked
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-950/80 p-5 text-slate-100 ring-1 ring-slate-800">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Total concepts</p>
              <p className="mt-3 text-3xl font-semibold">{total}</p>
            </div>
            <div className="rounded-3xl bg-slate-950/80 p-5 text-slate-100 ring-1 ring-slate-800">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Unique subjects</p>
              <p className="mt-3 text-3xl font-semibold">{uniqueSubjects}</p>
            </div>
            <div className="rounded-3xl bg-slate-950/80 p-5 text-slate-100 ring-1 ring-slate-800">
              <p className="text-sm uppercase tracking-[0.25em] text-slate-400">Average mastery</p>
              <p className="mt-3 text-3xl font-semibold">{averagePercent}%</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4">
          {concepts.map((concept) => {
            const mastery = getMasteryLabel(concept.mastery_level)
            const score = getProgressValue(concept.mastery_level)
            const pillClass = subjectColors[concept.subject] ?? 'bg-slate-700 text-slate-100'
            const strongAreas = normalizeArray(concept.strong_areas)
            const weakAreas = normalizeArray(concept.weak_areas)
            const nextSteps = normalizeArray(concept.next_steps)

            return (
              <details
                key={`${concept.subject}-${concept.concept}`}
                className="group overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900/90 shadow-sm transition hover:border-slate-700"
              >
                <summary className="flex cursor-pointer flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${pillClass}`}>
                        {concept.subject || 'Unknown'}
                      </span>
                      <span className="text-lg font-semibold text-slate-100">{concept.concept || 'Untitled concept'}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-slate-400">
                      <span className="inline-flex items-center rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-slate-200">
                        {mastery}
                      </span>
                      <span>Last updated {formatDate(concept.last_updated)}</span>
                    </div>
                  </div>
                  <div className="w-full max-w-sm sm:w-1/3">
                    <div className="overflow-hidden rounded-full bg-slate-800 ring-1 ring-slate-800">
                      <div
                        className="h-3 rounded-full bg-sky-500 transition-all duration-300"
                        style={{ width: `${(score / 4) * 100}%` }}
                      />
                    </div>
                    <p className="mt-2 text-right text-xs text-slate-400">Progress {Math.round((score / 4) * 100)}%</p>
                  </div>
                </summary>
                <div className="border-t border-slate-800 px-6 py-5 bg-slate-950/95">
                  {strongAreas.length > 0 && (
                    <div className="mb-4">
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">Strong areas</h3>
                      <div className="flex flex-wrap gap-2">
                        {strongAreas.map((item) => (
                          <span key={`strong-${item}`} className="rounded-full bg-emerald-900/70 px-3 py-1 text-sm text-emerald-100">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {weakAreas.length > 0 && (
                    <div className="mb-4">
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-rose-300">Weak areas</h3>
                      <div className="flex flex-wrap gap-2">
                        {weakAreas.map((item) => (
                          <span key={`weak-${item}`} className="rounded-full bg-rose-900/70 px-3 py-1 text-sm text-rose-100">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {nextSteps.length > 0 && (
                    <div>
                      <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.3em] text-sky-300">Next steps</h3>
                      <div className="flex flex-wrap gap-2">
                        {nextSteps.map((item) => (
                          <span key={`step-${item}`} className="rounded-full bg-sky-900/70 px-3 py-1 text-sm text-sky-100">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </details>
            )
          })}
        </div>
      </div>
    </div>
  )
}
