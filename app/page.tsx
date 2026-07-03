'use client'

import { FormEvent, useMemo, useState } from 'react'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  detectedSubject?: string
  detectedConcept?: string
  saveState?: 'idle' | 'saving' | 'saved' | 'error'
  saveMessage?: string
}

function makeId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`
}

function parseSavePayload(message: ChatMessage) {
  const text = message.text.trim()
  const subject = message.detectedSubject || ''
  const concept = message.detectedConcept || ''

  const lower = text.toLowerCase()
  const masteryLevel = /\b(strong|proficient)\b/.test(lower)
    ? 'Proficient'
    : /\b(introduced|developing|beginner)\b/.test(lower)
    ? 'Developing'
    : 'Developing'

  const overviewGist = text.split(/[\n\.]{1,2}\s+/).slice(0, 2).join('. ').trim()
  const deepDiveGist = text
    .split(/\n{2,}|\.{2,}|\r\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 20)
    .slice(0, 3)

  const findList = (label: string) => {
    const pattern = new RegExp(`${label}\\s*[:\\-]?\\s*([\\s\\S]*?)(?:\\n\\n|$)`, 'i')
    const match = text.match(pattern)
    if (!match?.[1]) return []
    return match[1]
      .split(/[;,\\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }

  const strongAreas = findList('strong areas|strengths|strong points')
  const weakAreas = findList('weak areas|weaknesses|weak points')
  const nextSteps = findList('next steps|next step|recommended next|follow-up|suggested next')

  return {
    subject,
    concept,
    masteryLevel,
    overviewGist: overviewGist || `Summary of ${subject} / ${concept}`,
    deepDiveGist: deepDiveGist.length ? deepDiveGist : [overviewGist || text.slice(0, 120)],
    strongAreas,
    weakAreas,
    nextSteps,
    notes: text,
  }
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === 'assistant'),
    [messages]
  )

  const appendMessage = (message: ChatMessage) => {
    setMessages((current) => [...current, message])
  }

  const handleSend = async (event: FormEvent) => {
    event.preventDefault()
    const userMessage = draft.trim()
    if (!userMessage || loading) return

    setError(null)
    setDraft('')
    setLoading(true)

    const userId = makeId('user')
    appendMessage({ id: userId, role: 'user', text: userMessage })

    let detectedSubject = ''
    let detectedConcept = ''

    try {
      const detectRes = await fetch('/api/detect-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage }),
      })
      const detectJson = await detectRes.json()
      detectedSubject = String(detectJson.subject || '').trim()
      detectedConcept = String(detectJson.concept || '').trim()
    } catch (err) {
      console.error(err)
    }

    const assistantId = makeId('assistant')
    appendMessage({
      id: assistantId,
      role: 'assistant',
      text: '',
      detectedSubject: detectedSubject || undefined,
      detectedConcept: detectedConcept || undefined,
      saveState: 'idle',
    })

    try {
      const chatRes = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage,
          subject: detectedSubject,
          concept: detectedConcept,
        }),
      })

      if (!chatRes.ok || !chatRes.body) {
        throw new Error('Chat response failed')
      }

      const reader = chatRes.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let assistantText = ''

      while (!done) {
        const { value, done: finished } = await reader.read()
        done = finished
        if (value) {
          const chunk = decoder.decode(value, { stream: !done })
          assistantText += chunk
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantId
                ? { ...message, text: assistantText }
                : message
            )
          )
        }
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                text: assistantText,
                saveState: detectedSubject && detectedConcept ? 'idle' : undefined,
              }
            : message
        )
      )
    } catch (err) {
      console.error(err)
      setError('Unable to load assistant response. Please try again.')
      setMessages((current) =>
        current.map((message) =>
          message.id === assistantId
            ? { ...message, text: 'Failed to load response.' }
            : message
        )
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (message: ChatMessage) => {
    if (!message.detectedSubject || !message.detectedConcept) return
    setMessages((current) =>
      current.map((item) =>
        item.id === message.id ? { ...item, saveState: 'saving', saveMessage: undefined } : item
      )
    )

    const payload = parseSavePayload(message)

    try {
      const res = await fetch('/api/save-concept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Save failed')
      }
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, saveState: 'saved', saveMessage: 'Progress saved.' }
            : item
        )
      )
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unable to save.'
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id
            ? { ...item, saveState: 'error', saveMessage: errorMessage }
            : item
        )
      )
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-950/95 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
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
      <main className="mx-auto flex h-screen max-w-4xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between rounded-3xl border border-slate-800 bg-slate-900/90 px-6 py-5 shadow-2xl shadow-slate-950/40 backdrop-blur-sm">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-sky-400/80">Study Agent</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50 sm:text-4xl">AI tutor chat</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400 sm:text-base">
              Type a question, let the assistant detect the concept, and save your progress when ready.
            </p>
          </div>
          <div className="rounded-3xl bg-slate-800/80 px-4 py-3 text-sm text-slate-300 ring-1 ring-slate-700">
            No auth · Single-user chat
          </div>
        </div>

        <section className="mt-6 flex flex-1 flex-col overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-900 shadow-2xl shadow-slate-950/50">
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6" style={{ minHeight: 0 }}>
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-3xl border px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-slate-800 text-slate-100 border-slate-700'
                      : 'bg-slate-950 text-slate-100 border-slate-800'
                  }`}>
                    {message.role === 'assistant' && (
                      <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
                        Assistant
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{message.text || (message.role === 'assistant' ? '...' : '')}</div>
                    {message.role === 'assistant' && message.detectedSubject && message.detectedConcept && (
                      <div className="mt-3 flex flex-col gap-2">
                        <div className="rounded-2xl bg-slate-900 px-3 py-2 text-xs text-slate-400">
                          Detected: <span className="text-slate-100">{message.detectedSubject}</span> / <span className="text-slate-100">{message.detectedConcept}</span>
                        </div>
                        <button
                          type="button"
                          className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition ${
                            message.saveState === 'saved'
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-sky-500 text-slate-950 hover:bg-sky-400'
                          }`}
                          onClick={() => handleSave(message)}
                          disabled={message.saveState === 'saving' || message.saveState === 'saved'}
                        >
                          {message.saveState === 'saving' ? 'Saving…' : message.saveState === 'saved' ? 'Saved' : 'Save progress'}
                        </button>
                        {message.saveMessage && (
                          <p className="text-xs text-slate-400">{message.saveMessage}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSend} className="border-t border-slate-800 bg-slate-950/90 px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label htmlFor="userMessage" className="sr-only">
                Type your message
              </label>
              <textarea
                id="userMessage"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                className="min-h-[72px] flex-1 resize-none rounded-3xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                placeholder="Ask a question or describe a concept you want to study..."
              />
              <button
                type="submit"
                disabled={loading || !draft.trim()}
                className="inline-flex h-12 items-center justify-center rounded-3xl bg-sky-500 px-6 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {loading ? 'Sending…' : 'Send'}
              </button>
            </div>
            {error && <p className="mt-3 text-sm text-rose-400">{error}</p>}
          </form>
        </section>
      </main>
    </div>
  )
}
