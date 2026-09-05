import { differenceInCalendarDays, parseISO } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { Bot, CheckCircle2, Leaf, Maximize2, MessageCircle, Minimize2, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAIStatus, useAssistantChat, useAssistantStory } from '../hooks/useApi'
import type { Plant } from '../types'

type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

const PLANT_SUGGESTIONS = [
  "How's she doing?",
  'Yesterday it grew 2 cm',
  'When did she first sprout?',
  'What was the weather like?',
  'Tell me its story',
  'I watered her today',
]

const GARDEN_SUGGESTIONS = [
  'How is my garden doing?',
  'Which plant needs attention?',
  'What changed this week?',
  'What should I check today?',
  'Summarize my recent logs',
]

function suggestionsForPage(currentPage?: string) {
  if (currentPage?.startsWith('plant/') || currentPage?.startsWith('plant')) {
    return PLANT_SUGGESTIONS
  }
  return GARDEN_SUGGESTIONS
}

type PlantAssistantProps = {
  plant: Plant | null
  plants?: Plant[]
  showPlantPicker?: boolean
  onPlantChange?: (plantId: number) => void
  currentPage?: string
  journalEntryId?: number
  selectedDate?: string
}

export function PlantAssistant({
  plant,
  plants = [],
  showPlantPicker = false,
  onPlantChange,
  currentPage,
  journalEntryId,
  selectedDate,
}: PlantAssistantProps) {
  const queryClient = useQueryClient()
  const { data: aiStatus } = useAIStatus()
  const chat = useAssistantChat(plant?.id ?? 0)
  const story = useAssistantStory(plant?.id ?? 0)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [plantStory, setPlantStory] = useState<string | null>(null)
  const [lastLogged, setLastLogged] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const suggestedQuestions = useMemo(() => suggestionsForPage(currentPage), [currentPage])

  const dayNumber = useMemo(() => {
    if (!plant?.planting_date) return null
    return differenceInCalendarDays(new Date(), parseISO(plant.planting_date)) + 1
  }, [plant?.planting_date])

  const unavailable = aiStatus && (!aiStatus.online || !aiStatus.assistant_enabled)
  const busy = chat.isPending || story.isPending
  const noPlants = plants.length === 0
  const needsPlant = !plant

  useEffect(() => {
    if (!open) return
    setMessages([])
    setConversationId(undefined)
    setPlantStory(null)
    setInput('')
    setLastLogged(null)
    setExpanded(false)
  }, [open, plant?.id])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = 'hidden'
    const timer = window.setTimeout(() => inputRef.current?.focus(), 300)
    return () => {
      document.body.style.overflow = ''
      window.clearTimeout(timer)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [open, messages, chat.isPending])

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy || !plant) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])

    try {
      const response = await chat.mutateAsync({
        message: trimmed,
        conversation_id: conversationId,
        history: messages.map((item) => ({ role: item.role, content: item.content })),
        journal_entry_id: journalEntryId,
        current_page: currentPage,
      })
      if (response.error) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.detail ?? 'Assistant unavailable.' },
        ])
        return
      }
      if (response.conversation_id) setConversationId(response.conversation_id)
      if (response.actions_applied?.length) {
        void queryClient.invalidateQueries({ queryKey: ['entries', String(plant.id)] })
        void queryClient.invalidateQueries({ queryKey: ['ai-memories'] })
        void queryClient.invalidateQueries({ queryKey: ['plants'] })
        setLastLogged(response.actions_applied.map((item) => item.summary).join(' '))
      }
      if (response.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: response.message! }])
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err instanceof Error ? err.message : 'Assistant unavailable.' },
      ])
    }
  }

  async function loadStory() {
    if (!plant) return
    try {
      const response = await story.mutateAsync()
      if (response.story) {
        setPlantStory(response.story)
        setMessages((prev) => [...prev, { role: 'assistant', content: response.story! }])
      } else if (response.detail || response.message) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: response.detail ?? response.message ?? 'Could not generate story.' },
        ])
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: err instanceof Error ? err.message : 'Assistant unavailable.' },
      ])
    }
  }

  function onSuggested(question: string) {
    if (question.toLowerCase().includes('story')) {
      void loadStory()
      return
    }
    void sendMessage(question)
  }

  const headerSubtitle = plant
    ? [plant.name, dayNumber ? `Day ${dayNumber}` : null, selectedDate].filter(Boolean).join(' · ')
    : noPlants
      ? 'Add a plant to get started'
      : 'Choose a plant below'

  return (
    <>
      {!open && (
        <div className="assistant-fab-wrap">
          <button
            aria-label="Ask Plantory"
            className="assistant-fab"
            onClick={() => setOpen(true)}
            type="button"
          >
            <MessageCircle className="h-6 w-6" />
            <span className="assistant-fab-label">Ask Plantory</span>
            {unavailable && <span aria-hidden="true" className="assistant-fab-dot" />}
          </button>
        </div>
      )}

      {open && (
        <>
          <button
            aria-label="Close assistant"
            className="assistant-backdrop"
            onClick={() => setOpen(false)}
            type="button"
          />

          <section
            aria-label="Plantory Assistant"
            aria-modal="true"
            className={['assistant-sheet', expanded ? 'assistant-sheet-expanded' : ''].join(' ')}
            role="dialog"
          >
            <div aria-hidden="true" className="assistant-sheet-handle" />

            <header className="assistant-sheet-header">
              <div className="flex min-w-0 items-center gap-3">
                <div className="assistant-sheet-icon">
                  <Leaf className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Ask Plantory
                  </p>
                  <p className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {headerSubtitle}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  aria-label={expanded ? 'Collapse chat' : 'Expand chat'}
                  className="assistant-sheet-close"
                  onClick={() => setExpanded((value) => !value)}
                  type="button"
                >
                  {expanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
                <button
                  aria-label="Close chat"
                  className="assistant-sheet-close"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </header>

            <div className="assistant-sheet-body">
              {showPlantPicker && plants.length > 0 && (
                <section className="assistant-info-card mb-3">
                  <p className="label mb-2">Talking about</p>
                  <div className="flex flex-wrap gap-2">
                    {plants.map((item) => (
                      <button
                        key={item.id}
                        className={[
                          'assistant-suggestion',
                          plant?.id === item.id ? 'assistant-suggestion-active' : '',
                        ].join(' ')}
                        onClick={() => onPlantChange?.(item.id)}
                        type="button"
                      >
                        {item.name}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {noPlants && (
                <section className="assistant-info-card mb-3">
                  <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                    Add your first plant to chat with Plantory about your garden.
                  </p>
                  <Link className="btn-primary mt-3 inline-flex w-full justify-center" to="/add" onClick={() => setOpen(false)}>
                    Add a plant
                  </Link>
                </section>
              )}

              {plant && (
                <section className="assistant-info-card">
                  <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Local AI · Private on your server
                  </div>
                  <p className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                    {plant.species}
                    {plant.location_name ? ` · ${plant.location_name}` : ''}
                  </p>
                  {lastLogged && (
                    <p className="mt-2 flex items-start gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      Logged to journal: {lastLogged}
                    </p>
                  )}
                  {unavailable && (
                    <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
                      Assistant unavailable
                    </p>
                  )}
                </section>
              )}

              {plant && messages.length === 0 && (
                <section className="mb-3 mt-3">
                  <p className="label mb-2">Suggested questions</p>
                  <div className="assistant-suggestions">
                    {suggestedQuestions.map((question) => (
                      <button
                        key={question}
                        className="assistant-suggestion"
                        disabled={busy || !!unavailable}
                        onClick={() => onSuggested(question)}
                        type="button"
                      >
                        {question}
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {plantStory && messages.length === 0 && (
                <section className="assistant-info-card mb-3">
                  <p className="label mb-2">Plant story</p>
                  <p className="text-sm leading-6" style={{ color: 'var(--text-primary)' }}>{plantStory}</p>
                </section>
              )}

              <div className="space-y-3 pb-2">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={[
                      'assistant-bubble',
                      message.role === 'user' ? 'assistant-bubble-user' : 'assistant-bubble-bot',
                    ].join(' ')}
                  >
                    {message.role === 'assistant' && (
                      <Bot className="mb-1 h-4 w-4 shrink-0" style={{ color: 'var(--accent)' }} />
                    )}
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                ))}
                {busy && (
                  <p className="px-1 text-sm" style={{ color: 'var(--text-muted)' }}>Thinking...</p>
                )}
                <div ref={bottomRef} />
              </div>
            </div>

            <footer className="assistant-sheet-footer">
              <form
                className="flex items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault()
                  void sendMessage(input)
                }}
              >
                <input
                  ref={inputRef}
                  autoComplete="off"
                  className="input min-h-[48px] flex-1 text-base"
                  disabled={busy || !!unavailable || needsPlant || noPlants}
                  enterKeyHint="send"
                  inputMode="text"
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={
                    noPlants
                      ? 'Add a plant first'
                      : needsPlant
                        ? 'Select a plant above'
                        : unavailable
                          ? 'Assistant unavailable'
                          : 'Ask something...'
                  }
                  type="text"
                  value={input}
                />
                <button
                  aria-label="Send message"
                  className="assistant-send-btn"
                  disabled={busy || !!unavailable || !input.trim() || needsPlant || noPlants}
                  type="submit"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </footer>
          </section>
        </>
      )}
    </>
  )
}
