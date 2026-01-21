import { formatJsonValue } from './format'
import { normalizeSessionId, SESSION_ID_PREFIX_REGEX, SESSION_ID_REGEX } from './url'
import type { ParsedItem, SessionDetails, Turn } from './types'

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

export const extractSessionDetails = (entry: any): SessionDetails => {
  const payload = entry?.payload ?? entry
  return {
    sessionId: extractSessionIdFromObject(payload) ?? undefined,
    cwd: extractCwdFromObject(payload) ?? undefined,
  }
}

export const extractSessionIdFromPath = (value?: string | null) => {
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

export const parseJsonl = (raw: string) => {
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
