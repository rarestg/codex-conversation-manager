import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { unified } from 'unified'
import remarkParse from 'remark-parse'

const MAX_PREVIEW_CHARS = 2000
const prismStyle: Record<string, CSSProperties> =
  solarizedlight as unknown as Record<string, CSSProperties>
const markdownSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [...(defaultSchema.attributes?.code || []), ['className']],
    pre: [...(defaultSchema.attributes?.pre || []), ['className']],
  },
}

type ParsedItemType =
  | 'user'
  | 'assistant'
  | 'thought'
  | 'tool_call'
  | 'tool_output'
  | 'meta'
  | 'token_count'

interface ParsedItem {
  id: string
  type: ParsedItemType
  content: string
  seq: number
  timestamp?: string
  callId?: string
  toolName?: string
  raw?: unknown
}

interface Turn {
  id: number
  startedAt?: string
  items: ParsedItem[]
  isPreamble?: boolean
}

interface SessionFileEntry {
  id: string
  filename: string
  size: number
  preview?: string | null
  timestamp?: string | null
  cwd?: string | null
}

interface SessionTree {
  root: string
  years: Array<{
    year: string
    months: Array<{
      month: string
      days: Array<{
        day: string
        files: SessionFileEntry[]
      }>
    }>
  }>
}

interface SessionDetails {
  sessionId?: string
  cwd?: string
}

interface SearchResult {
  id: number
  content: string
  session_id: string
  turn_id: number
  role: string
  timestamp?: string | null
  session_timestamp?: string | null
  cwd?: string | null
  git_branch?: string | null
  git_repo?: string | null
  snippet?: string | null
}

const copyText = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

const mdastToText = (node: any): string => {
  if (!node) return ''
  switch (node.type) {
    case 'root':
      return node.children.map(mdastToText).join('').replace(/\n{3,}/g, '\n\n').trimEnd()
    case 'text':
      return node.value
    case 'inlineCode':
      return node.value
    case 'code':
      return `${node.value}\n`
    case 'break':
      return '\n'
    case 'paragraph':
    case 'heading':
      return `${node.children.map(mdastToText).join('')}\n\n`
    case 'list':
      return `${node.children.map(mdastToText).join('')}\n`
    case 'listItem':
      return `${node.children.map(mdastToText).join('')}\n`
    case 'blockquote':
      return `${node.children.map(mdastToText).join('')}\n\n`
    case 'thematicBreak':
      return '\n\n'
    case 'table':
      return `${node.children.map(mdastToText).join('')}\n`
    case 'tableRow':
      return `${node.children.map(mdastToText).join('\t')}\n`
    case 'tableCell':
      return node.children.map(mdastToText).join('')
    default:
      if (node.children) return node.children.map(mdastToText).join('')
      return ''
  }
}

const markdownToPlainText = async (markdown: string) => {
  const processor = unified().use(remarkParse).use(remarkGfm)
  const tree = processor.parse(markdown)
  return mdastToText(tree)
}

const formatJsonValue = (value: unknown) => {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return String(value)
  }
}

const formatToolCall = (item: any) => {
  const name = item?.name || item?.tool_name || item?.tool?.name || 'tool'
  const callId = item?.call_id || item?.id || item?.callId
  const args = item?.arguments ?? item?.args ?? item?.input ?? item?.parameters
  const parts = [`name: ${name}`]
  if (callId) parts.push(`call_id: ${callId}`)
  const argsText = formatJsonValue(args)
  if (argsText) parts.push(`arguments:\n${argsText}`)
  return { name, callId, content: parts.join('\n') }
}

const formatToolOutput = (item: any) => {
  const callId = item?.call_id || item?.id || item?.callId
  const output = item?.output ?? item?.result ?? item?.content ?? item?.text ?? item?.value
  const parts: string[] = []
  if (callId) parts.push(`call_id: ${callId}`)
  const outputText = formatJsonValue(output)
  if (outputText) parts.push(`output:\n${outputText}`)
  return { callId, content: parts.join('\n') }
}

const SESSION_ID_REGEX = /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/
const SESSION_ID_PREFIX_REGEX = /\b(?:sess(?:ion)?[_-])[a-zA-Z0-9_-]{6,}\b/

const normalizeSessionId = (value: string) => {
  const trimmed = value.trim()
  const uuidMatch = trimmed.match(SESSION_ID_REGEX)
  if (uuidMatch) return uuidMatch[0]
  const prefixMatch = trimmed.match(SESSION_ID_PREFIX_REGEX)
  if (prefixMatch) return prefixMatch[0]
  return trimmed
}

const extractSessionIdFromObject = (value: unknown, depth = 0): string | null => {
  if (!value || typeof value !== 'object' || depth > 2) return null
  const obj = value as Record<string, unknown>
  const direct =
    obj.session_id ??
    obj.sessionId ??
    obj.conversation_id ??
    obj.conversationId ??
    obj.resume_session_id ??
    obj.resumeSessionId
  if (typeof direct === 'string' && direct.trim()) return normalizeSessionId(direct)
  if (typeof obj.session === 'string' && obj.session.trim()) return normalizeSessionId(obj.session)
  if (obj.session && typeof obj.session === 'object') {
    const nestedId = (obj.session as Record<string, unknown>).id
    if (typeof nestedId === 'string' && nestedId.trim()) return normalizeSessionId(nestedId)
    const nested = extractSessionIdFromObject(obj.session, depth + 1)
    if (nested) return nested
  }
  const containers = [obj.session_info, obj.sessionInfo, obj.metadata, obj.context, obj.payload]
  for (const container of containers) {
    const nested = extractSessionIdFromObject(container, depth + 1)
    if (nested) return nested
  }
  return null
}

const extractCwdFromObject = (value: unknown, depth = 0): string | null => {
  if (!value || typeof value !== 'object' || depth > 2) return null
  const obj = value as Record<string, unknown>
  const direct =
    obj.cwd ??
    obj.current_working_directory ??
    obj.working_dir ??
    obj.workingDirectory ??
    obj.repo_root ??
    obj.workspace_root ??
    obj.root_dir
  if (typeof direct === 'string' && direct.trim()) return direct.trim()
  if (obj.session && typeof obj.session === 'object') {
    const nested = extractCwdFromObject(obj.session, depth + 1)
    if (nested) return nested
  }
  const containers = [obj.metadata, obj.context, obj.environment, obj.env, obj.workspace, obj.payload]
  for (const container of containers) {
    const nested = extractCwdFromObject(container, depth + 1)
    if (nested) return nested
  }
  return null
}

const extractSessionDetails = (entry: any): SessionDetails => {
  const payload = entry?.payload ?? entry
  return {
    sessionId: extractSessionIdFromObject(payload) ?? undefined,
    cwd: extractCwdFromObject(payload) ?? undefined,
  }
}

const extractSessionIdFromPath = (value?: string | null) => {
  if (!value) return null
  const normalized = value.replace(/\\/g, '/')
  const filename = normalized.split('/').pop() || normalized
  const withoutExt = filename.replace(/\.jsonl$/i, '')
  const uuidMatch = withoutExt.match(SESSION_ID_REGEX)
  if (uuidMatch) return uuidMatch[0]
  const prefixMatch = withoutExt.match(SESSION_ID_PREFIX_REGEX)
  if (prefixMatch) return prefixMatch[0]
  return null
}

const parseJsonl = (raw: string) => {
  const lines = raw.split('\n')
  const errors: string[] = []
  const turns: Turn[] = []
  const preambleItems: ParsedItem[] = []
  const turnMap = new Map<number, Turn>()
  let currentTurn = 0
  let seq = 0
  const sessionInfo: SessionDetails = {}
  let sessionIdRank = 0
  let cwdRank = 0

  const updateSessionInfo = (details: SessionDetails, rank: number) => {
    if (details.sessionId && rank >= sessionIdRank) {
      sessionInfo.sessionId = details.sessionId
      sessionIdRank = rank
    }
    if (details.cwd && rank >= cwdRank) {
      sessionInfo.cwd = details.cwd
      cwdRank = rank
    }
  }

  const ensureTurn = (turnId: number, startedAt?: string) => {
    if (turnMap.has(turnId)) return turnMap.get(turnId)!
    const turn: Turn = { id: turnId, startedAt, items: [] }
    turnMap.set(turnId, turn)
    turns.push(turn)
    return turn
  }

  const addItem = (item: ParsedItem) => {
    if (currentTurn === 0) {
      preambleItems.push(item)
      return
    }
    const turn = ensureTurn(currentTurn, item.timestamp)
    turn.items.push(item)
  }

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    if (!line.trim()) continue
    seq += 1
    try {
      const entry = JSON.parse(line)
      if (entry.type === 'event_msg') {
        const payload = entry.payload ?? {}
        if (payload.type === 'user_message' && payload.message) {
          currentTurn += 1
          const turn = ensureTurn(currentTurn, entry.timestamp)
          const content = formatJsonValue(payload.message)
          turn.items.push({
            id: `item-${seq}`,
            type: 'user',
            content,
            seq,
            timestamp: entry.timestamp,
            raw: entry,
          })
        } else if (payload.type === 'agent_message' && payload.message) {
          addItem({
            id: `item-${seq}`,
            type: 'assistant',
            content: formatJsonValue(payload.message),
            seq,
            timestamp: entry.timestamp,
            raw: entry,
          })
        } else if (payload.type === 'agent_reasoning' && payload.text) {
          addItem({
            id: `item-${seq}`,
            type: 'thought',
            content: formatJsonValue(payload.text),
            seq,
            timestamp: entry.timestamp,
            raw: entry,
          })
        } else if (payload.type === 'token_count') {
          addItem({
            id: `item-${seq}`,
            type: 'token_count',
            content: formatJsonValue(payload),
            seq,
            timestamp: entry.timestamp,
            raw: entry,
          })
        }
        continue
      }

      if (entry.type === 'turn_context' || entry.type === 'session_meta') {
        const details = extractSessionDetails(entry)
        const rank = entry.type === 'session_meta' ? 3 : 2
        updateSessionInfo(details, rank)
        addItem({
          id: `item-${seq}`,
          type: 'meta',
          content: formatJsonValue(entry.payload ?? entry),
          seq,
          timestamp: entry.timestamp,
          raw: entry,
        })
        continue
      }

      const isResponseItem = entry.type === 'response_item'
      const item = isResponseItem ? (entry.item ?? entry.response_item ?? entry.payload ?? {}) : entry
      const itemType = isResponseItem ? item.type : entry.type

      if (['function_call', 'custom_tool_call', 'web_search_call'].includes(itemType)) {
        const formatted = formatToolCall(item)
        addItem({
          id: `item-${seq}`,
          type: 'tool_call',
          content: formatted.content,
          seq,
          timestamp: entry.timestamp,
          callId: formatted.callId,
          toolName: formatted.name,
          raw: item,
        })
        continue
      }

      if (['function_call_output', 'custom_tool_call_output'].includes(itemType)) {
        const formatted = formatToolOutput(item)
        addItem({
          id: `item-${seq}`,
          type: 'tool_output',
          content: formatted.content,
          seq,
          timestamp: entry.timestamp,
          callId: formatted.callId,
          raw: item,
        })
      }
    } catch (error: any) {
      errors.push(`Line ${i + 1}: ${error?.message || 'Parse error'}`)
    }
  }

  const output: Turn[] = []
  if (preambleItems.length > 0) {
    output.push({ id: 0, items: preambleItems, isPreamble: true })
  }
  output.push(...turns)

  return { turns: output, errors, sessionInfo }
}

const generateId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

const Toggle = ({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
}) => {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-white/70 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-slate-900">{label}</div>
        {description && <div className="text-xs text-slate-500">{description}</div>}
      </div>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-full">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span className="absolute inset-0 rounded-full bg-slate-200 transition-colors peer-checked:bg-teal-600" />
        <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  )
}

const renderSnippet = (snippet?: string | null) => {
  if (!snippet) return null
  const parts = snippet.split(/\[\[|\]\]/g)
  return parts.map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className="rounded bg-amber-200/70 px-1 text-slate-900">
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  )
}

export default function ConversationViewer() {
  const [sessionsTree, setSessionsTree] = useState<SessionTree | null>(null)
  const [activeSession, setActiveSession] = useState<SessionFileEntry | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [showThoughts, setShowThoughts] = useState(true)
  const [showTools, setShowTools] = useState(true)
  const [showMeta, setShowMeta] = useState(false)
  const [showFullContent, setShowFullContent] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [sessionDetails, setSessionDetails] = useState<SessionDetails>({})
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sessionsRoot, setSessionsRoot] = useState('')
  const [sessionsRootSource, setSessionsRootSource] = useState<string>('')
  const [reindexing, setReindexing] = useState(false)
  const [indexSummary, setIndexSummary] = useState<string>('')
  const [scrollToTurnId, setScrollToTurnId] = useState<number | null>(null)
  const searchTimeout = useRef<number | null>(null)

  const filteredTurns = useMemo(() => {
    return turns.map((turn) => {
      const items = turn.items.filter((item) => {
        if (item.type === 'thought' && !showThoughts) return false
        if ((item.type === 'tool_call' || item.type === 'tool_output') && !showTools) return false
        if ((item.type === 'meta' || item.type === 'token_count') && !showMeta) return false
        return true
      })
      return { ...turn, items }
    })
  }, [turns, showThoughts, showTools, showMeta])

  const visibleItemCount = useMemo(() => {
    return filteredTurns.reduce((count, turn) => count + turn.items.length, 0)
  }, [filteredTurns])

  const loadConfig = async () => {
    try {
      const res = await fetch('/api/config')
      if (!res.ok) {
        throw new Error('Unable to load config.')
      }
      const data = await res.json()
      setSessionsRoot(data.value || '')
      setSessionsRootSource(data.source || '')
    } catch (error: any) {
      setApiError(error?.message || 'Failed to load config.')
    }
  }

  const loadSessions = async () => {
    try {
      setApiError(null)
      const res = await fetch('/api/sessions')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || 'Unable to load sessions.')
      }
      const data: SessionTree = await res.json()
      setSessionsTree(data)
    } catch (error: any) {
      setApiError(error?.message || 'Failed to load sessions.')
    }
  }

  useEffect(() => {
    loadConfig()
    loadSessions()
  }, [])

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      return
    }
    if (searchTimeout.current) {
      window.clearTimeout(searchTimeout.current)
    }
    searchTimeout.current = window.setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}&limit=40`)
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data?.error || 'Search failed.')
        }
        const data = await res.json()
        setSearchResults(data.results || [])
      } catch (error: any) {
        setApiError(error?.message || 'Search failed.')
      } finally {
        setSearchLoading(false)
      }
    }, 350)

    return () => {
      if (searchTimeout.current) {
        window.clearTimeout(searchTimeout.current)
      }
    }
  }, [searchQuery])

  useEffect(() => {
    if (!scrollToTurnId) return
    const element = document.getElementById(`turn-${scrollToTurnId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setScrollToTurnId(null)
  }, [scrollToTurnId, turns])

  const findSessionById = (sessionId: string) => {
    if (!sessionsTree) return null
    for (const year of sessionsTree.years) {
      for (const month of year.months) {
        for (const day of month.days) {
          const file = day.files.find((entry) => entry.id === sessionId)
          if (file) return file
        }
      }
    }
    return null
  }

  const loadSession = async (sessionId: string, turnId?: number) => {
    try {
      setLoadingSession(true)
      setApiError(null)
      const res = await fetch(`/api/session?path=${encodeURIComponent(sessionId)}`)
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data?.error || 'Unable to load session file.')
      }
      const raw = await res.text()
      const parsed = parseJsonl(raw)
      setTurns(parsed.turns)
      setParseErrors(parsed.errors)
      const meta =
        findSessionById(sessionId) ?? ({ id: sessionId, filename: sessionId, size: 0 } as SessionFileEntry)
      const fallbackSessionId = extractSessionIdFromPath(meta.filename || meta.id)
      const resolvedSessionId = parsed.sessionInfo.sessionId || fallbackSessionId || undefined
      const resolvedCwd = parsed.sessionInfo.cwd || meta.cwd || undefined
      setSessionDetails({ sessionId: resolvedSessionId, cwd: resolvedCwd })
      setActiveSession(meta)
      setScrollToTurnId(turnId ?? null)
    } catch (error: any) {
      setApiError(error?.message || 'Failed to load session.')
    } finally {
      setLoadingSession(false)
    }
  }

  const handleCopyConversation = async () => {
    const convId = generateId()
    const counters: Record<string, number> = {
      user: 0,
      assistant: 0,
      thought: 0,
      tool_call: 0,
      tool_output: 0,
      meta: 0,
      token_count: 0,
    }

    const items = filteredTurns.flatMap((turn) => turn.items)
    const formatted = items
      .map((item) => {
        counters[item.type] += 1
        const count = counters[item.type]
        if (item.type === 'user') return `<USER-MSG-${count}>\n${item.content}\n</USER-MSG-${count}>`
        if (item.type === 'assistant') {
          return `<ASSISTANT-RESPONSE-${count}>\n${item.content}\n</ASSISTANT-RESPONSE-${count}>`
        }
        if (item.type === 'thought') {
          return `<THINKING-${count}>\n${item.content}\n</THINKING-${count}>`
        }
        if (item.type === 'tool_call') {
          const nameAttr = item.toolName ? ` name="${item.toolName}"` : ''
          const callAttr = item.callId ? ` call_id="${item.callId}"` : ''
          return `<TOOL-CALL-${count}${nameAttr}${callAttr}>\n${item.content}\n</TOOL-CALL-${count}>`
        }
        if (item.type === 'tool_output') {
          const callAttr = item.callId ? ` call_id="${item.callId}"` : ''
          return `<TOOL-OUTPUT-${count}${callAttr}>\n${item.content}\n</TOOL-OUTPUT-${count}>`
        }
        return `<META-${count}>\n${item.content}\n</META-${count}>`
      })
      .join('\n\n')

    await copyText(`<CONVERSATION-${convId}>\n\n${formatted}\n\n</CONVERSATION-${convId}>`)
    setCopiedId('conversation')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleCopyItem = async (item: ParsedItem, format: 'text' | 'markdown') => {
    const raw = item.content
    const text = format === 'text' ? await markdownToPlainText(raw) : raw
    await copyText(text)
    setCopiedId(item.id + format)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleCopyMeta = async (value: string, id: string) => {
    await copyText(value)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleSaveRoot = async () => {
    try {
      setApiError(null)
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionsRoot }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Unable to update config.')
      setSessionsRootSource('config')
      await loadSessions()
      await loadConfig()
    } catch (error: any) {
      setApiError(error?.message || 'Failed to update config.')
    }
  }

  const handleReindex = async () => {
    try {
      setReindexing(true)
      const res = await fetch('/api/reindex', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Reindex failed.')
      const summary = data.summary
      setIndexSummary(
        `Scanned ${summary.scanned} files · Updated ${summary.updated} · Removed ${summary.removed} · ${summary.messageCount} messages`,
      )
      await loadSessions()
    } catch (error: any) {
      setApiError(error?.message || 'Reindex failed.')
    } finally {
      setReindexing(false)
    }
  }

  return (
    <div className="min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <header className="flex flex-col gap-3 rounded-3xl border border-white/70 bg-white/70 px-6 py-5 shadow-soft backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-teal-700">
                Codex Conversation Manager
              </p>
              <h1 className="mt-2 text-3xl text-slate-900">Session Explorer & Conversation Viewer</h1>
              <p className="mt-1 text-sm text-slate-600">
                Browse local Codex JSONL sessions, inspect turns, and search across your own history.
              </p>
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900"
            >
              Settings
            </button>
          </div>
          {apiError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {apiError}
            </div>
          )}
        </header>

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="w-full max-w-none space-y-5 lg:w-[340px]">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg text-slate-900">Search sessions</h2>
                  <p className="text-xs text-slate-500">Full-text search across user and assistant messages.</p>
                </div>
                {searchLoading && (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Searching…</span>
                )}
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search messages"
                className="mt-4 w-full rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-200"
              />
              {searchResults.length > 0 && (
                <div className="mt-4 space-y-3">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => loadSession(result.session_id, result.turn_id)}
                      className="w-full rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-left text-sm text-slate-700 transition hover:border-teal-200 hover:bg-white"
                    >
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{result.session_id}</span>
                        <span>Turn {result.turn_id}</span>
                      </div>
                      <div className="mt-2 text-sm text-slate-700">{renderSnippet(result.snippet)}</div>
                    </button>
                  ))}
                </div>
              )}
              {searchQuery && !searchLoading && searchResults.length === 0 && (
                <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">
                  No matches yet. Try another query or reindex.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-card backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg text-slate-900">Sessions</h2>
                  <p className="text-xs text-slate-500">Root: {sessionsTree?.root || sessionsRoot || '—'}</p>
                </div>
                <button
                  onClick={loadSessions}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600 shadow-sm hover:text-slate-900"
                >
                  Refresh
                </button>
              </div>
              <div className="mt-4 max-h-[60vh] space-y-3 overflow-auto pr-1">
                {sessionsTree?.years.length ? (
                  sessionsTree.years.map((year) => (
                    <details key={year.year} open className="group">
                      <summary className="cursor-pointer list-none rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                        {year.year}
                      </summary>
                      <div className="mt-2 space-y-2 pl-2">
                        {year.months.map((month) => (
                          <details key={`${year.year}-${month.month}`} className="group">
                            <summary className="cursor-pointer list-none rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
                              {month.month}
                            </summary>
                            <div className="mt-2 space-y-2 pl-2">
                              {month.days.map((day) => (
                                <details key={`${year.year}-${month.month}-${day.day}`} className="group">
                                  <summary className="cursor-pointer list-none rounded-xl bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-500">
                                    {day.day}
                                  </summary>
                                  <div className="mt-2 space-y-2 pl-2">
                                    {day.files.map((file) => (
                                      <button
                                        key={file.id}
                                        onClick={() => loadSession(file.id)}
                                        className={`w-full rounded-2xl border px-3 py-2 text-left text-xs transition ${
                                          activeSession?.id === file.id
                                            ? 'border-teal-300 bg-teal-50 text-teal-800'
                                            : 'border-slate-100 bg-white text-slate-600 hover:border-teal-200 hover:text-slate-900'
                                        }`}
                                      >
                                        <div className="font-medium">{file.filename}</div>
                                        {file.preview && (
                                          <div className="mt-1 max-h-9 overflow-hidden text-[11px] text-slate-500">
                                            {file.preview}
                                          </div>
                                        )}
                                      </button>
                                    ))}
                                  </div>
                                </details>
                              ))}
                            </div>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                    No sessions found yet. Update your sessions root in settings.
                  </div>
                )}
              </div>
            </div>
          </aside>

          <main className="flex-1 min-w-0 space-y-6">
            <div className="rounded-3xl border border-white/70 bg-white/80 p-6 shadow-card backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 space-y-2">
                  <h2 className="text-xl text-slate-900">{activeSession ? activeSession.filename : 'Session viewer'}</h2>
                  <p className="text-xs text-slate-500">
                    {activeSession?.timestamp
                      ? `Session: ${formatTimestamp(activeSession.timestamp)}`
                      : 'Select a session to start.'}
                  </p>
                  {(sessionDetails.sessionId || sessionDetails.cwd) && (
                    <div className="grid gap-2 text-xs sm:grid-cols-2">
                      {sessionDetails.sessionId && (
                        <div className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 shadow-sm">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                            Session
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-slate-700" title={sessionDetails.sessionId}>
                            {sessionDetails.sessionId}
                          </span>
                          <button
                            onClick={() => handleCopyMeta(sessionDetails.sessionId!, 'session-id')}
                            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            {copiedId === 'session-id' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                      {sessionDetails.cwd && (
                        <div className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-slate-600 shadow-sm">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
                            Dir
                          </span>
                          <span className="min-w-0 flex-1 truncate font-mono text-slate-700" title={sessionDetails.cwd}>
                            {sessionDetails.cwd}
                          </span>
                          <button
                            onClick={() => handleCopyMeta(sessionDetails.cwd!, 'session-cwd')}
                            className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500"
                          >
                            {copiedId === 'session-cwd' ? 'Copied' : 'Copy'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
                    {visibleItemCount} visible items
                  </span>
                  <button
                    onClick={handleCopyConversation}
                    disabled={!visibleItemCount}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                  >
                    {copiedId === 'conversation' ? 'Copied' : 'Copy conversation'}
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Toggle
                  label="Show thoughts"
                  description="Include agent reasoning inline."
                  checked={showThoughts}
                  onChange={setShowThoughts}
                />
                <Toggle
                  label="Show tools"
                  description="Tool calls and outputs inline."
                  checked={showTools}
                  onChange={setShowTools}
                />
                <Toggle
                  label="Show metadata"
                  description="turn_context, session_meta, token_count."
                  checked={showMeta}
                  onChange={setShowMeta}
                />
                <Toggle
                  label="Show full content"
                  description="Disable truncation for long messages."
                  checked={showFullContent}
                  onChange={setShowFullContent}
                />
              </div>
            </div>

            {loadingSession && (
              <div className="rounded-3xl border border-white/70 bg-white/80 p-6 text-sm text-slate-600 shadow-card">
                Loading session…
              </div>
            )}

            {parseErrors.length > 0 && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
                <div className="font-semibold">Parse warnings</div>
                <ul className="mt-2 list-disc space-y-1 pl-4">
                  {parseErrors.slice(0, 6).map((error) => (
                    <li key={error}>{error}</li>
                  ))}
                  {parseErrors.length > 6 && <li>…and {parseErrors.length - 6} more</li>}
                </ul>
              </div>
            )}

            {!loadingSession && activeSession && filteredTurns.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                No conversation messages found in this session.
              </div>
            )}

            {!activeSession && (
              <div className="rounded-3xl border border-dashed border-slate-200 px-6 py-10 text-center text-sm text-slate-500">
                Pick a session from the sidebar to view the conversation.
              </div>
            )}

            <div className="space-y-6">
              {filteredTurns.map((turn, index) => (
                <section
                  key={`turn-${turn.id}-${index}`}
                  id={`turn-${turn.id}`}
                  className="animate-rise rounded-3xl border border-white/80 bg-white/80 p-6 shadow-card"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-600">
                        {turn.isPreamble ? 'Session Preamble' : `Turn ${turn.id}`}
                      </p>
                      {turn.startedAt && (
                        <p className="text-xs text-slate-500">{formatTimestamp(turn.startedAt)}</p>
                      )}
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500">
                      {turn.items.length} items
                    </span>
                  </div>

                  <div className="mt-4 space-y-4">
                    {turn.items.map((item, itemIndex) => {
                      const isMarkdownItem = ['user', 'assistant', 'thought'].includes(item.type)
                      const displayContent = item.content
                      const truncated =
                        !showFullContent && displayContent.length > MAX_PREVIEW_CHARS
                          ? `${displayContent.slice(0, MAX_PREVIEW_CHARS)}…`
                          : displayContent
                      const roleLabel =
                        item.type === 'user'
                          ? 'User'
                          : item.type === 'assistant'
                          ? 'Assistant'
                          : item.type === 'thought'
                          ? 'Thought'
                          : item.type === 'tool_call'
                          ? 'Tool Call'
                          : item.type === 'tool_output'
                          ? 'Tool Output'
                          : item.type === 'token_count'
                          ? 'Token Count'
                          : 'Meta'

                      const tone =
                        item.type === 'user'
                          ? 'border-blue-200/70 bg-blue-50/80 text-blue-900'
                          : item.type === 'assistant'
                          ? 'border-emerald-200/70 bg-emerald-50/80 text-emerald-900'
                          : item.type === 'thought'
                          ? 'border-amber-200/70 bg-amber-50/80 text-amber-900'
                          : item.type === 'tool_call'
                          ? 'border-indigo-200/70 bg-indigo-50/80 text-indigo-900'
                          : item.type === 'tool_output'
                          ? 'border-rose-200/70 bg-rose-50/80 text-rose-900'
                          : 'border-slate-200/70 bg-slate-50/80 text-slate-800'

                      return (
                        <div
                          key={item.id}
                          className={`animate-stagger rounded-2xl border px-4 py-4 text-sm shadow-sm ${tone}`}
                          style={{ '--stagger-delay': `${itemIndex * 40}ms` } as CSSProperties}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.2em]">{roleLabel}</p>
                              {item.toolName && (
                                <p className="mt-1 text-xs text-slate-500">Tool: {item.toolName}</p>
                              )}
                              {item.callId && (
                                <p className="text-xs text-slate-500">Call ID: {item.callId}</p>
                              )}
                            </div>
                            {isMarkdownItem && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleCopyItem(item, 'text')}
                                  className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                                >
                                  {copiedId === item.id + 'text' ? 'Copied' : 'Copy text'}
                                </button>
                                <button
                                  onClick={() => handleCopyItem(item, 'markdown')}
                                  className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                                >
                                  {copiedId === item.id + 'markdown' ? 'Copied' : 'Copy MD'}
                                </button>
                              </div>
                            )}
                            {['tool_call', 'tool_output', 'meta', 'token_count'].includes(item.type) && (
                              <button
                                onClick={() => handleCopyItem(item, 'markdown')}
                                className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm"
                              >
                                {copiedId === item.id + 'markdown' ? 'Copied' : 'Copy'}
                              </button>
                            )}
                          </div>

                          <div className="mt-3">
                            {isMarkdownItem ? (
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[[rehypeSanitize, markdownSchema]]}
                                components={{
                                  code({ className, children, ...props }) {
                                    const match = /language-(\w+)/.exec(className || '')
                                    if (match) {
                                      return (
                                        <div className="overflow-x-auto rounded-xl bg-white/70">
                                          <SyntaxHighlighter
                                            style={prismStyle}
                                            language={match[1]}
                                            PreTag="div"
                                            customStyle={{ margin: 0, borderRadius: '12px', background: 'transparent' }}
                                          >
                                            {String(children).replace(/\n$/, '')}
                                          </SyntaxHighlighter>
                                        </div>
                                      )
                                    }
                                    return (
                                      <code
                                        className="rounded bg-white/70 px-1 py-0.5 text-xs"
                                        {...props}
                                      >
                                        {children}
                                      </code>
                                    )
                                  },
                                  ul({ children }) {
                                    return <ul className="ml-6 list-disc space-y-1">{children}</ul>
                                  },
                                  ol({ children }) {
                                    return <ol className="ml-6 list-decimal space-y-1">{children}</ol>
                                  },
                                  p({ children }) {
                                    return <p className="mb-2 whitespace-pre-wrap last:mb-0">{children}</p>
                                  },
                                  li({ children }) {
                                    return <li className="whitespace-pre-wrap">{children}</li>
                                  },
                                  blockquote({ children }) {
                                    return (
                                      <blockquote className="border-l-2 border-slate-300 pl-4 text-slate-600 whitespace-pre-wrap">
                                        {children}
                                      </blockquote>
                                    )
                                  },
                                }}
                              >
                                {truncated}
                              </ReactMarkdown>
                            ) : (
                              <pre className="whitespace-pre-wrap rounded-xl bg-white/70 p-3 text-xs text-slate-800">
                                {truncated || '—'}
                              </pre>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </main>
        </div>
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-lg rounded-3xl border border-white/70 bg-white p-6 shadow-soft">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl text-slate-900">Settings</h3>
                <p className="text-xs text-slate-500">Manage session root and indexing.</p>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-500 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  Sessions root ({sessionsRootSource || 'custom'})
                </label>
                <input
                  value={sessionsRoot}
                  onChange={(event) => setSessionsRoot(event.target.value)}
                  disabled={sessionsRootSource === 'env'}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-200 disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleSaveRoot}
                  disabled={sessionsRootSource === 'env'}
                  className="rounded-full border border-teal-200 bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Save root
                </button>
                <button
                  onClick={handleReindex}
                  disabled={reindexing}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-60"
                >
                  {reindexing ? 'Reindexing…' : 'Reindex'}
                </button>
              </div>
              {indexSummary && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  {indexSummary}
                </div>
              )}
              {sessionsRootSource === 'env' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  CODEX_SESSIONS_ROOT is set via environment variable. Update it in your shell to change the
                  root.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
