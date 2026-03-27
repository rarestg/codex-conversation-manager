import { extractSessionIdFromObject, extractSessionIdFromPath, normalizeSessionId } from './parseCore';
import type {
  ParsedSessionGraphResult,
  SessionGraphChildLink,
  SessionGraphNotification,
  SessionGraphSourceKind,
  SessionGraphSpawnCall,
  SessionGraphSpawnOutput,
  SessionGraphWaitEvent,
} from './types';

type PendingWaitCall = {
  seq: number;
  timestamp?: string;
  callId: string | null;
  agentIds: string[];
  rawArguments: unknown;
};

type PendingFunctionOutput = {
  seq: number;
  timestamp?: string;
  callId: string | null;
  rawOutput: unknown;
  lineNumber: number;
};

type SessionLineage = {
  sourceKind: SessionGraphSourceKind;
  parentSessionId: string | null;
  agentNickname: string | null;
  agentRole: string | null;
  depth: number | null;
};

type ChildLinkEntry = {
  firstSeq: number;
  link: SessionGraphChildLink;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const getObjectRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const getString = (value: unknown) => (typeof value === 'string' ? value : undefined);

const getTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const getBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined);

const getFiniteNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

const normalizeOptionalSessionId = (value: unknown) => {
  const trimmed = getTrimmedString(value);
  return trimmed ? normalizeSessionId(trimmed) : null;
};

const getThreadSpawnRecord = (value: unknown): Record<string, unknown> | null => {
  const sourceRecord = getObjectRecord(value);
  if (!sourceRecord) return null;
  const subagentRecord = getObjectRecord(sourceRecord.subagent);
  return getObjectRecord(subagentRecord?.thread_spawn) ?? getObjectRecord(sourceRecord.thread_spawn);
};

const extractMessageText = (value: unknown): string | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractMessageText(item);
      if (nested !== null) return nested;
    }
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (Array.isArray(obj.lines)) {
    const lines = obj.lines.filter((line): line is string => typeof line === 'string');
    if (lines.length > 0) return lines.join('\n');
  }
  if (obj.text !== undefined) {
    const nested = extractMessageText(obj.text);
    if (nested !== null) return nested;
  }
  if (obj.content !== undefined) {
    const nested = extractMessageText(obj.content);
    if (nested !== null) return nested;
  }
  if (obj.value !== undefined) {
    const nested = extractMessageText(obj.value);
    if (nested !== null) return nested;
  }
  return null;
};

const parseEmbeddedJson = (value: unknown, label: string, lineNumber: number, errors: string[]) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'JSON parse error';
      errors.push(`Line ${lineNumber}: ${label}: ${message}`);
      return null;
    }
  }
  return value;
};

export const extractSessionLineage = (value: unknown): SessionLineage => {
  const obj = asRecord(value);
  const source = obj.source;
  const threadSpawn = getThreadSpawnRecord(source);
  return {
    sourceKind: threadSpawn ? 'subagent' : getTrimmedString(source) === 'cli' ? 'root' : 'unknown',
    parentSessionId: normalizeOptionalSessionId(threadSpawn?.parent_thread_id),
    agentNickname: getTrimmedString(threadSpawn?.agent_nickname) ?? getTrimmedString(obj.agent_nickname) ?? null,
    agentRole: getTrimmedString(threadSpawn?.agent_role) ?? null,
    depth: getFiniteNumber(threadSpawn?.depth) ?? null,
  };
};

export const mergeSessionLineage = (current: SessionLineage, next: SessionLineage): SessionLineage => ({
  sourceKind: next.sourceKind === 'subagent' || current.sourceKind === 'unknown' ? next.sourceKind : current.sourceKind,
  parentSessionId: next.parentSessionId ?? current.parentSessionId,
  agentNickname: next.agentNickname ?? current.agentNickname,
  agentRole: next.agentRole ?? current.agentRole,
  depth: next.depth ?? current.depth,
});

const createChildLinkEntry = (agentId: string | null, firstSeq: number): ChildLinkEntry => ({
  firstSeq,
  link: {
    agentId,
    nickname: null,
    spawnedAt: null,
    spawnCallId: null,
    agentType: null,
    model: null,
    reasoningEffort: null,
    forkContext: null,
    dispatchPrompt: null,
    latestWaitStatus: undefined,
    latestNotification: null,
  },
});

const getOrCreateAgentChildEntry = (
  agentChildEntryById: Map<string, ChildLinkEntry>,
  agentId: string,
  seq: number,
): ChildLinkEntry => {
  const existing = agentChildEntryById.get(agentId);
  if (existing) {
    if (seq < existing.firstSeq) existing.firstSeq = seq;
    return existing;
  }

  const entry = createChildLinkEntry(agentId, seq);
  agentChildEntryById.set(agentId, entry);
  return entry;
};

const applySpawnCallToChildLink = (
  link: SessionGraphChildLink,
  spawnCall: SessionGraphSpawnCall,
  output?: SessionGraphSpawnOutput,
) => {
  link.nickname = output?.nickname ?? link.nickname;
  link.spawnedAt = spawnCall.timestamp ?? link.spawnedAt;
  link.spawnCallId = spawnCall.callId;
  link.agentType = spawnCall.agentType;
  link.model = spawnCall.model;
  link.reasoningEffort = spawnCall.reasoningEffort;
  link.forkContext = spawnCall.forkContext;
  link.dispatchPrompt = spawnCall.dispatchPrompt;
};

const mergeSpawnLinkIntoAgentLink = (target: SessionGraphChildLink, source: SessionGraphChildLink) => {
  target.nickname = target.nickname ?? source.nickname;
  target.spawnedAt = target.spawnedAt ?? source.spawnedAt;
  target.spawnCallId = target.spawnCallId ?? source.spawnCallId;
  target.agentType = target.agentType ?? source.agentType;
  target.model = target.model ?? source.model;
  target.reasoningEffort = target.reasoningEffort ?? source.reasoningEffort;
  target.forkContext = target.forkContext ?? source.forkContext;
  target.dispatchPrompt = target.dispatchPrompt ?? source.dispatchPrompt;
};

const findSingleAgentOnlyEntry = (
  agentEntries: Iterable<ChildLinkEntry>,
  startSeq: number,
  endSeq: number,
): ChildLinkEntry | null => {
  let candidate: ChildLinkEntry | null = null;
  for (const entry of agentEntries) {
    if (entry.link.spawnCallId || entry.firstSeq < startSeq || entry.firstSeq >= endSeq) continue;
    if (candidate) return null;
    candidate = entry;
  }
  return candidate;
};

export const parseSubagentNotificationText = (
  text: string,
  seq: number,
  timestamp: string | undefined,
  lineNumber: number,
  errors: string[],
): SessionGraphNotification | null => {
  const trimmed = text.trim();
  if (!trimmed.startsWith('<subagent_notification>')) return null;

  const match = trimmed.match(/^<subagent_notification>\s*([\s\S]*?)\s*<\/subagent_notification>$/u);
  const payloadText = match ? match[1] : trimmed.replace(/^<subagent_notification>\s*/u, '');
  const payload = parseEmbeddedJson(payloadText, 'Invalid subagent notification JSON', lineNumber, errors);
  const payloadRecord = asRecord(payload);

  return {
    seq,
    timestamp,
    agentId: normalizeOptionalSessionId(payloadRecord.agent_id),
    status: payloadRecord.status ?? null,
    rawText: text,
    rawPayload: payload,
  };
};

export const parseSessionGraph = ({
  raw,
  sessionPath,
}: {
  raw: string;
  sessionPath?: string | null;
}): ParsedSessionGraphResult => {
  const lines = raw.split('\n');
  const errors: string[] = [];
  const spawnCalls: SessionGraphSpawnCall[] = [];
  const spawnCallById = new Map<string, SessionGraphSpawnCall>();
  const waitCalls: PendingWaitCall[] = [];
  const pendingOutputs: PendingFunctionOutput[] = [];
  const notifications: SessionGraphNotification[] = [];

  let seq = 0;
  let sessionId = extractSessionIdFromPath(sessionPath) ?? null;
  let sessionIdRank = sessionId ? 4 : 0;
  let lineage: ReturnType<typeof extractSessionLineage> = {
    sourceKind: 'unknown',
    parentSessionId: null,
    agentNickname: null,
    agentRole: null,
    depth: null,
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    seq += 1;

    try {
      const entry = JSON.parse(line) as Record<string, unknown>;
      const entryType = getString(entry.type);
      const timestamp = getString(entry.timestamp);

      if (entryType === 'session_meta') {
        const payload = entry.payload ?? entry;
        const extractedSessionId = extractSessionIdFromObject(payload);
        if (extractedSessionId && 3 > sessionIdRank) {
          sessionId = extractedSessionId;
          sessionIdRank = 3;
        }
        lineage = mergeSessionLineage(lineage, extractSessionLineage(payload));
        continue;
      }

      if (entryType !== 'response_item') continue;
      const item = entry.item ?? entry.response_item ?? entry.payload ?? {};
      const itemRecord = asRecord(item);
      const itemType = getString(itemRecord.type);

      if (itemType === 'function_call') {
        const name = getTrimmedString(itemRecord.name);
        const callId = getTrimmedString(itemRecord.call_id) ?? null;
        if (name === 'spawn_agent') {
          const parsedArguments = parseEmbeddedJson(
            itemRecord.arguments,
            'Invalid spawn_agent arguments JSON',
            i + 1,
            errors,
          );
          const args = asRecord(parsedArguments);
          const spawnCall: SessionGraphSpawnCall = {
            seq,
            timestamp,
            callId,
            agentType: getTrimmedString(args.agent_type) ?? null,
            model: getTrimmedString(args.model) ?? null,
            reasoningEffort: getTrimmedString(args.reasoning_effort) ?? null,
            forkContext: getBoolean(args.fork_context) ?? null,
            dispatchPrompt: getTrimmedString(args.message) ?? null,
            rawArguments: parsedArguments,
          };
          spawnCalls.push(spawnCall);
          if (callId) spawnCallById.set(callId, spawnCall);
          continue;
        }

        if (name === 'wait_agent') {
          const parsedArguments = parseEmbeddedJson(
            itemRecord.arguments,
            'Invalid wait_agent arguments JSON',
            i + 1,
            errors,
          );
          const args = asRecord(parsedArguments);
          const idsSource = Array.isArray(args.ids) ? args.ids : [];
          const agentIds = idsSource
            .map((id) => normalizeOptionalSessionId(id))
            .filter((id): id is string => Boolean(id));
          waitCalls.push({
            seq,
            timestamp,
            callId,
            agentIds,
            rawArguments: parsedArguments,
          });
          continue;
        }
      }

      if (itemType === 'function_call_output') {
        pendingOutputs.push({
          seq,
          timestamp,
          callId: getTrimmedString(itemRecord.call_id) ?? null,
          rawOutput: itemRecord.output,
          lineNumber: i + 1,
        });
        continue;
      }

      if (itemType === 'message' && getTrimmedString(itemRecord.role) === 'user') {
        const text = extractMessageText(itemRecord.content);
        if (!text) continue;
        const notification = parseSubagentNotificationText(text, seq, timestamp, i + 1, errors);
        if (notification) notifications.push(notification);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Parse error';
      errors.push(`Line ${i + 1}: ${message}`);
    }
  }

  const spawnOutputs: SessionGraphSpawnOutput[] = [];
  const waitEvents: SessionGraphWaitEvent[] = [];
  const outputByCallId = new Map(
    pendingOutputs
      .filter((output): output is PendingFunctionOutput & { callId: string } => Boolean(output.callId))
      .map((output) => [output.callId, output] as const),
  );

  for (const output of pendingOutputs) {
    if (output.callId && spawnCallById.has(output.callId)) {
      const parsedOutput = parseEmbeddedJson(
        output.rawOutput,
        'Invalid spawn_agent output JSON',
        output.lineNumber,
        errors,
      );
      const record = asRecord(parsedOutput);
      spawnOutputs.push({
        seq: output.seq,
        timestamp: output.timestamp,
        callId: output.callId,
        agentId: normalizeOptionalSessionId(record.agent_id),
        nickname: getTrimmedString(record.nickname) ?? null,
        rawOutput: parsedOutput,
      });
    }
  }

  for (const waitCall of waitCalls) {
    const output = waitCall.callId ? outputByCallId.get(waitCall.callId) : undefined;
    const parsedOutput = output
      ? parseEmbeddedJson(output.rawOutput, 'Invalid wait_agent output JSON', output.lineNumber, errors)
      : null;
    const record = asRecord(parsedOutput);
    const statusRecord = asRecord(record.status);
    const statusByAgentId: Record<string, unknown> = {};
    for (const [agentId, status] of Object.entries(statusRecord)) {
      const normalized = normalizeOptionalSessionId(agentId);
      if (normalized) statusByAgentId[normalized] = status;
    }
    waitEvents.push({
      seq: output?.seq ?? waitCall.seq,
      timestamp: output?.timestamp ?? waitCall.timestamp,
      callId: waitCall.callId,
      agentIds: waitCall.agentIds,
      statusByAgentId,
      timedOut: typeof record.timed_out === 'boolean' ? record.timed_out : null,
      rawArguments: waitCall.rawArguments,
      rawOutput: parsedOutput,
    });
  }

  const latestWaitStatusByAgentId: Record<string, unknown> = {};
  for (const waitEvent of waitEvents.sort((a, b) => a.seq - b.seq)) {
    for (const [agentId, status] of Object.entries(waitEvent.statusByAgentId)) {
      latestWaitStatusByAgentId[agentId] = status;
    }
  }

  const latestNotificationByAgentId: Record<string, SessionGraphNotification> = {};
  for (const notification of notifications) {
    if (notification.agentId) {
      latestNotificationByAgentId[notification.agentId] = notification;
    }
  }

  const spawnOutputByCallId = new Map(
    spawnOutputs
      .filter((output): output is SessionGraphSpawnOutput & { callId: string } => Boolean(output.callId))
      .map((output) => [output.callId, output] as const),
  );
  const agentChildEntryById = new Map<string, ChildLinkEntry>();
  const unresolvedSpawnEntries: ChildLinkEntry[] = [];

  for (const spawnCall of spawnCalls) {
    const output = spawnCall.callId ? spawnOutputByCallId.get(spawnCall.callId) : undefined;
    if (output?.agentId) {
      const entry = getOrCreateAgentChildEntry(agentChildEntryById, output.agentId, spawnCall.seq);
      applySpawnCallToChildLink(entry.link, spawnCall, output);
      continue;
    }

    const entry = createChildLinkEntry(null, spawnCall.seq);
    applySpawnCallToChildLink(entry.link, spawnCall, output);
    unresolvedSpawnEntries.push(entry);
  }

  for (const waitEvent of waitEvents) {
    const agentIds = new Set([...waitEvent.agentIds, ...Object.keys(waitEvent.statusByAgentId)]);
    for (const agentId of agentIds) {
      getOrCreateAgentChildEntry(agentChildEntryById, agentId, waitEvent.seq);
    }
  }

  for (const notification of notifications) {
    if (!notification.agentId) continue;
    getOrCreateAgentChildEntry(agentChildEntryById, notification.agentId, notification.seq);
  }

  // When spawn output is missing, only collapse a placeholder into an agent-linked child
  // if ordering leaves a single candidate before the next unresolved spawn.
  const remainingSpawnEntries: ChildLinkEntry[] = [];
  for (let index = 0; index < unresolvedSpawnEntries.length; index += 1) {
    const unresolved = unresolvedSpawnEntries[index];
    const nextUnresolvedSeq = unresolvedSpawnEntries[index + 1]?.firstSeq ?? Number.POSITIVE_INFINITY;
    const candidate = findSingleAgentOnlyEntry(agentChildEntryById.values(), unresolved.firstSeq, nextUnresolvedSeq);
    if (!candidate) {
      remainingSpawnEntries.push(unresolved);
      continue;
    }
    mergeSpawnLinkIntoAgentLink(candidate.link, unresolved.link);
    if (unresolved.firstSeq < candidate.firstSeq) candidate.firstSeq = unresolved.firstSeq;
  }

  const spawnedChildren: SessionGraphChildLink[] = [...agentChildEntryById.values(), ...remainingSpawnEntries]
    .sort((a, b) => a.firstSeq - b.firstSeq)
    .map(({ link }) => {
      if (link.agentId) {
        link.latestWaitStatus = latestWaitStatusByAgentId[link.agentId];
        link.latestNotification = latestNotificationByAgentId[link.agentId] ?? null;
      }
      return link;
    });

  return {
    sessionId,
    sessionPath: sessionPath ?? null,
    ...lineage,
    spawnCalls,
    spawnOutputs,
    waitEvents,
    notifications,
    spawnedChildren,
    latestWaitStatusByAgentId,
    latestNotificationByAgentId,
    parseErrors: errors,
  };
};
