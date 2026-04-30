#!/usr/bin/env node

import fsp from 'node:fs/promises';
import { ensureRootExists, resolveSessionsRoot } from '../server/config';
import { sanitizeGitRepoFields } from '../server/gitRepo';
import {
  buildSessionGraphLocator,
  getChildSessionEntries,
  getSessionEntryById,
  resolveSessionSpecifier,
} from '../shared/codex-session/locator';
import { formatJsonValue, parseSessionCore } from '../shared/codex-session/parseCore';
import { normalizeCwd } from '../shared/codex-session/path';
import { parseSessionGraph } from '../shared/codex-session/sessionGraph';
import type {
  CanonicalSessionMessage,
  ParsedSessionCoreResult,
  ParsedSessionGraphResult,
  SessionGraphChildLink,
  SessionGraphLocator,
  SessionGraphLocatorEntry,
  SessionGraphWaitEvent,
} from '../shared/codex-session/types';

const GLOBAL_HELP_TEXT = `Codex Session CLI

Usage:
  npm run codex-session -- <command> [args] [--json]

Commands:
  overview <session>
  show <session> [--role assistant] [--phase final_answer] [--index -1]
  subagents <session>
  parent <session>

Global options:
  --json  Emit machine-readable JSON for the selected command.

Examples:
  npm run codex-session -- overview 019d222b-f7a3-7160-8f05-775a9121935a
  npm run codex-session -- show 019d222b-f7a3-7160-8f05-775a9121935a --role assistant --phase final_answer --index -1
  npm run codex-session -- subagents 019d2221-1ba5-75b2-b4f1-efd4440b08a4 --json

Notes:
  <session> accepts an exact session ID or a direct session path under the resolved sessions root.
  show filters canonical event_msg messages only.
  Parent-side <subagent_notification> data is surfaced only through the graph-aware commands.
  Non-negative indices are 0-based; negative indices count from the end.`;

const OVERVIEW_HELP_TEXT = `Usage:
  npm run codex-session -- overview <session> [--json]

Reports session identity, lineage, timestamps, first user prompt, and tool-call count.`;

const SHOW_HELP_TEXT = `Usage:
  npm run codex-session -- show <session> [--role assistant] [--phase final_answer] [--index -1] [--json]

Options:
  --role <assistant|user|thought>  Canonical event_msg role to filter. Default: assistant
  --phase <phase>                  Optional phase filter. Useful for assistant final_answer retrieval.
  --index <n>                      0-based index or negative index from the end. Default: -1
  --json                           Emit the selected canonical message as JSON plus match metadata.`;

const SUBAGENTS_HELP_TEXT = `Usage:
  npm run codex-session -- subagents <session> [--json]

Lists subagents discovered from the parent-side graph, then enriches resolvable child sessions with
their latest canonical assistant message and latest canonical final_answer.`;

const PARENT_HELP_TEXT = `Usage:
  npm run codex-session -- parent <session> [--json]

Resolves a child session back to its parent session and prints key parent metadata.`;

type ShowRole = CanonicalSessionMessage['role'];
type CommandOptions = {
  json: boolean;
};

type LoadedSession = {
  locatorEntry: SessionGraphLocatorEntry;
  parsedCore: ParsedSessionCoreResult;
  parsedGraph: ParsedSessionGraphResult;
  parseWarnings: string[];
};

type ResolvedSession = {
  locator: SessionGraphLocator;
  loaded: LoadedSession;
};

type SubagentCommandRow = {
  link: SessionGraphChildLink;
  childEntry: SessionGraphLocatorEntry | null;
  childLoaded: LoadedSession | null;
  childLoadError: string | null;
  latestWaitEvent: SessionGraphWaitEvent | null;
  latestAssistantMessage: CanonicalSessionMessage | null;
  latestFinalAnswer: CanonicalSessionMessage | null;
};

class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

class CliUsageError extends CliError {
  constructor(message: string) {
    super(message, 1);
    this.name = 'CliUsageError';
  }
}

const getOptionValue = (arg: string, name: string) => {
  if (arg === name) return { matched: true, inlineValue: null as string | null };
  const prefix = `${name}=`;
  if (arg.startsWith(prefix)) {
    return { matched: true, inlineValue: arg.slice(prefix.length) };
  }
  return { matched: false, inlineValue: null as string | null };
};

const extractJsonFlag = (args: string[]) => {
  let json = false;
  const rest: string[] = [];
  for (const arg of args) {
    if (arg === '--json') {
      json = true;
      continue;
    }
    rest.push(arg);
  }
  return { args: rest, json };
};

const consumeOptionValue = (args: string[], index: number, inlineValue: string | null, name: string) => {
  if (inlineValue !== null) {
    if (!inlineValue.trim()) {
      throw new CliUsageError(`Option ${name} requires a value.`);
    }
    return { value: inlineValue, nextIndex: index };
  }

  const nextValue = args[index + 1];
  if (nextValue === undefined || !nextValue.trim()) {
    throw new CliUsageError(`Option ${name} requires a value.`);
  }
  return { value: nextValue, nextIndex: index + 1 };
};

const parseSingleSessionArgument = (args: string[], command: string) => {
  let session: string | null = null;

  for (const arg of args) {
    if (arg.startsWith('-')) {
      throw new CliUsageError(`Unknown option: ${arg}`);
    }
    if (session) {
      throw new CliUsageError(`Unexpected argument: ${arg}`);
    }
    session = arg;
  }

  if (!session) {
    throw new CliUsageError(`${command} requires exactly one <session> argument.`);
  }

  return session;
};

const parseShowRole = (value: string): ShowRole => {
  if (value === 'assistant' || value === 'user' || value === 'thought') {
    return value;
  }
  throw new CliUsageError(`Unsupported role: ${value}`);
};

const parseIndexValue = (value: string) => {
  if (!/^-?\d+$/u.test(value)) {
    throw new CliUsageError(`Invalid index: ${value}`);
  }
  return Number.parseInt(value, 10);
};

const indentWith = (value: string, prefix: string) =>
  value
    .split(/\r?\n/u)
    .map((line) => `${prefix}${line}`)
    .join('\n');

const indentBlock = (value: string) => indentWith(value, '  ');

const formatOptional = (value: string | number | boolean | null | undefined) =>
  value === null || value === undefined ? 'n/a' : String(value);

const formatTurnLabel = (turnIndex: number | null) => (turnIndex === null ? 'preamble' : String(turnIndex));

const resolveMatchIndex = (length: number, requestedIndex: number) => {
  if (length <= 0) {
    throw new CliError('No matching messages found.');
  }

  const resolvedIndex = requestedIndex < 0 ? length + requestedIndex : requestedIndex;
  if (resolvedIndex < 0 || resolvedIndex >= length) {
    throw new CliError(`Index ${requestedIndex} is out of range for ${length} matching message(s).`);
  }

  return resolvedIndex;
};

const formatUnknownValue = (value: unknown) => {
  const text = formatJsonValue(value);
  return text.trim() ? text : null;
};

const pushBlock = (lines: string[], label: string, value: string | null | undefined, prefix = '') => {
  lines.push(`${prefix}${label}:`);
  lines.push(indentWith(value ?? 'n/a', `${prefix}  `));
};

const loadLocator = async (): Promise<SessionGraphLocator> => {
  const rootInfo = await resolveSessionsRoot();
  const rootExists = await ensureRootExists(rootInfo.value);
  if (!rootExists) {
    throw new CliError(
      `Sessions root not found: ${rootInfo.value}. Set CODEX_SESSIONS_ROOT or update ~/.codex-formatter/config.json`,
    );
  }

  return buildSessionGraphLocator(rootInfo.value);
};

const resolveSessionEntry = (locator: SessionGraphLocator, specifier: string) => {
  const locatorEntry = resolveSessionSpecifier(locator, specifier);
  if (!locatorEntry) {
    throw new CliError(`Unable to resolve session: ${specifier}`);
  }

  return locatorEntry;
};

const loadSessionFromEntry = async (locatorEntry: SessionGraphLocatorEntry): Promise<LoadedSession> => {
  const raw = await fsp.readFile(locatorEntry.path, 'utf-8');
  const parsedCore = parseSessionCore({
    raw,
    sessionPath: locatorEntry.path,
    normalizeCwd,
    sanitizeEntry: sanitizeGitRepoFields,
  });
  const parsedGraph = parseSessionGraph({
    raw,
    sessionPath: locatorEntry.path,
  });
  const parseWarnings = [...parsedCore.parseErrors, ...parsedGraph.parseErrors];

  return {
    locatorEntry,
    parsedCore,
    parsedGraph,
    parseWarnings,
  };
};

const loadSession = async (specifier: string): Promise<ResolvedSession> => {
  const locator = await loadLocator();
  const locatorEntry = resolveSessionEntry(locator, specifier);
  const loaded = await loadSessionFromEntry(locatorEntry);
  return { locator, loaded };
};

const getResolvedSessionId = ({ locatorEntry, parsedCore, parsedGraph }: LoadedSession) =>
  parsedCore.summary.sessionId ?? parsedGraph.sessionId ?? locatorEntry.sessionId;

const getResolvedParentSessionId = ({ locatorEntry, parsedGraph }: LoadedSession) =>
  parsedGraph.parentSessionId ?? locatorEntry.parentSessionId;

const getResolvedSourceKind = ({ locatorEntry, parsedGraph }: LoadedSession) =>
  parsedGraph.sourceKind === 'unknown' ? locatorEntry.sourceKind : parsedGraph.sourceKind;

const getResolvedAgentNickname = ({ locatorEntry, parsedGraph }: LoadedSession) =>
  parsedGraph.agentNickname ?? locatorEntry.agentNickname;

const getResolvedAgentRole = ({ locatorEntry, parsedGraph }: LoadedSession) =>
  parsedGraph.agentRole ?? locatorEntry.agentRole;

const getResolvedDepth = ({ locatorEntry, parsedGraph }: LoadedSession) => parsedGraph.depth ?? locatorEntry.depth;

const printParseWarnings = ({ parseWarnings }: LoadedSession, label?: string) => {
  if (parseWarnings.length === 0) return;
  const target = label ? ` while parsing ${label}` : '';
  console.error(`Warning: encountered ${parseWarnings.length} parse warning(s)${target}; output may be incomplete.`);
  for (const warning of parseWarnings.slice(0, 5)) {
    console.error(`- ${warning}`);
  }
  if (parseWarnings.length > 5) {
    console.error(`- ... ${parseWarnings.length - 5} additional warning(s) omitted`);
  }
  console.error('');
};

const emitJson = (value: unknown) => {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
};

const maybePrintParseWarnings = (loaded: LoadedSession, options: CommandOptions, label?: string) => {
  if (options.json) return;
  printParseWarnings(loaded, label);
};

const buildLocatorEntryRecord = (entry: SessionGraphLocatorEntry) => ({
  sessionId: entry.sessionId,
  path: entry.path,
  sourceKind: entry.sourceKind,
  parentSessionId: entry.parentSessionId,
  agentNickname: entry.agentNickname,
  agentRole: entry.agentRole,
  depth: entry.depth,
});

const buildSessionRecord = (loaded: LoadedSession) => ({
  sessionId: getResolvedSessionId(loaded),
  path: loaded.locatorEntry.path,
  sourceKind: getResolvedSourceKind(loaded),
  parentSessionId: getResolvedParentSessionId(loaded),
  agentNickname: getResolvedAgentNickname(loaded),
  agentRole: getResolvedAgentRole(loaded),
  depth: getResolvedDepth(loaded),
  workspace: loaded.parsedCore.summary.cwd,
  startedAt: loaded.parsedCore.summary.startedAt,
  endedAt: loaded.parsedCore.summary.endedAt,
  turnCount: loaded.parsedCore.summary.turnCount,
  toolCallCount: loaded.parsedCore.summary.toolCallCount,
  firstUserMessage: loaded.parsedCore.summary.preview,
  parseWarnings: loaded.parseWarnings,
});

const buildCanonicalMessageRecord = (message: CanonicalSessionMessage) => ({
  seq: message.seq,
  turnIndex: message.turnIndex,
  timestamp: message.timestamp ?? null,
  role: message.role,
  phase: message.phase ?? null,
  content: message.content,
  source: message.source,
});

const buildWaitEventRecord = (waitEvent: SessionGraphWaitEvent | null) =>
  waitEvent
    ? {
        seq: waitEvent.seq,
        timestamp: waitEvent.timestamp ?? null,
        callId: waitEvent.callId,
        agentIds: waitEvent.agentIds,
        statusByAgentId: waitEvent.statusByAgentId,
        timedOut: waitEvent.timedOut,
      }
    : null;

const buildNotificationRecord = (notification: SessionGraphChildLink['latestNotification']) =>
  notification
    ? {
        seq: notification.seq,
        timestamp: notification.timestamp ?? null,
        agentId: notification.agentId,
        status: notification.status,
      }
    : null;

const printOverview = (loaded: LoadedSession) => {
  const { locatorEntry, parsedCore } = loaded;
  const sessionId = getResolvedSessionId(loaded);
  const lines = [
    `Session ID: ${formatOptional(sessionId)}`,
    `Path: ${locatorEntry.path}`,
    `Source: ${getResolvedSourceKind(loaded)}`,
    `Parent Session ID: ${formatOptional(getResolvedParentSessionId(loaded))}`,
    `Agent Nickname: ${formatOptional(getResolvedAgentNickname(loaded))}`,
    `Agent Role: ${formatOptional(getResolvedAgentRole(loaded))}`,
    `Depth: ${formatOptional(getResolvedDepth(loaded))}`,
    `Workspace: ${formatOptional(parsedCore.summary.cwd)}`,
    `Started At: ${formatOptional(parsedCore.summary.startedAt)}`,
    `Ended At: ${formatOptional(parsedCore.summary.endedAt)}`,
    `Turns: ${formatOptional(parsedCore.summary.turnCount)}`,
    `Tool Calls: ${parsedCore.summary.toolCallCount}`,
  ];

  console.log(lines.join('\n'));

  if (parsedCore.summary.preview) {
    console.log('\nFirst User Message:');
    console.log(indentBlock(parsedCore.summary.preview));
  }
};

const selectCanonicalMessages = (parsedCore: ParsedSessionCoreResult, role: ShowRole, phase: string | null) =>
  parsedCore.canonicalMessages.filter((message) => {
    if (message.role !== role) return false;
    if (phase === null) return true;
    return (message.phase ?? null) === phase;
  });

const selectLatestCanonicalMessage = (parsedCore: ParsedSessionCoreResult, role: ShowRole, phase: string | null) => {
  const matchingMessages = selectCanonicalMessages(parsedCore, role, phase);
  return matchingMessages.length > 0 ? matchingMessages[matchingMessages.length - 1] : null;
};

const getLatestWaitEvent = (
  parsedGraph: ParsedSessionGraphResult,
  agentId: string | null,
): SessionGraphWaitEvent | null => {
  if (!agentId) return null;
  let latest: SessionGraphWaitEvent | null = null;
  for (const waitEvent of parsedGraph.waitEvents) {
    if (!waitEvent.agentIds.includes(agentId) && !(agentId in waitEvent.statusByAgentId)) {
      continue;
    }
    latest = waitEvent;
  }
  return latest;
};

const printMessage = (
  loaded: LoadedSession,
  message: CanonicalSessionMessage,
  requestedIndex: number,
  resolvedIndex: number,
  totalMatches: number,
) => {
  const sessionId = getResolvedSessionId(loaded);
  const lines = [
    `Session ID: ${formatOptional(sessionId)}`,
    `Path: ${loaded.locatorEntry.path}`,
    `Source: ${message.source}`,
    `Role: ${message.role}`,
    `Phase: ${formatOptional(message.phase)}`,
    `Requested Index: ${requestedIndex}`,
    `Resolved Match: ${resolvedIndex + 1}/${totalMatches}`,
    `Timestamp: ${formatOptional(message.timestamp)}`,
    `Turn: ${formatTurnLabel(message.turnIndex)}`,
  ];

  console.log(lines.join('\n'));
  console.log('');
  process.stdout.write(message.content);
  process.stdout.write('\n');
};

const buildOverviewResult = (loaded: LoadedSession) => ({
  command: 'overview',
  session: buildSessionRecord(loaded),
});

const runOverview = async (args: string[], options: CommandOptions) => {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(OVERVIEW_HELP_TEXT);
    return;
  }

  const session = parseSingleSessionArgument(args, 'overview');
  const { loaded } = await loadSession(session);
  maybePrintParseWarnings(loaded, options);
  if (options.json) {
    emitJson(buildOverviewResult(loaded));
    return;
  }
  printOverview(loaded);
};

const buildShowResult = (
  loaded: LoadedSession,
  message: CanonicalSessionMessage,
  role: ShowRole,
  phase: string | null,
  requestedIndex: number,
  resolvedIndex: number,
  totalMatches: number,
) => ({
  command: 'show',
  session: buildSessionRecord(loaded),
  request: {
    role,
    phase,
    index: requestedIndex,
  },
  match: {
    resolvedIndex,
    ordinal: resolvedIndex + 1,
    totalMatches,
  },
  message: buildCanonicalMessageRecord(message),
});

const runShow = async (args: string[], options: CommandOptions) => {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(SHOW_HELP_TEXT);
    return;
  }

  let session: string | null = null;
  let role: ShowRole = 'assistant';
  let phase: string | null = null;
  let index = -1;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (!arg.startsWith('-')) {
      if (!session) {
        session = arg;
        continue;
      }
      throw new CliUsageError(`Unexpected argument: ${arg}`);
    }

    const roleOption = getOptionValue(arg, '--role');
    if (roleOption.matched) {
      const consumed = consumeOptionValue(args, i, roleOption.inlineValue, '--role');
      role = parseShowRole(consumed.value);
      i = consumed.nextIndex;
      continue;
    }

    const phaseOption = getOptionValue(arg, '--phase');
    if (phaseOption.matched) {
      const consumed = consumeOptionValue(args, i, phaseOption.inlineValue, '--phase');
      phase = consumed.value;
      i = consumed.nextIndex;
      continue;
    }

    const indexOption = getOptionValue(arg, '--index');
    if (indexOption.matched) {
      const consumed = consumeOptionValue(args, i, indexOption.inlineValue, '--index');
      index = parseIndexValue(consumed.value);
      i = consumed.nextIndex;
      continue;
    }

    throw new CliUsageError(`Unknown option: ${arg}`);
  }

  if (!session) {
    throw new CliUsageError('show requires a <session> argument.');
  }

  const { loaded } = await loadSession(session);
  maybePrintParseWarnings(loaded, options);
  const matchingMessages = selectCanonicalMessages(loaded.parsedCore, role, phase);
  if (matchingMessages.length === 0) {
    const sessionId = getResolvedSessionId(loaded);
    const phaseSuffix = phase ? ` with phase ${phase}` : '';
    throw new CliError(`No canonical ${role} messages found for session ${sessionId}${phaseSuffix}.`);
  }
  const resolvedIndex = resolveMatchIndex(matchingMessages.length, index);
  const selected = matchingMessages[resolvedIndex];

  if (options.json) {
    emitJson(buildShowResult(loaded, selected, role, phase, index, resolvedIndex, matchingMessages.length));
    return;
  }
  printMessage(loaded, selected, index, resolvedIndex, matchingMessages.length);
};

const loadSubagentCommandRows = async (
  locator: SessionGraphLocator,
  loaded: LoadedSession,
): Promise<SubagentCommandRow[]> => {
  const rows: SubagentCommandRow[] = [];
  for (const link of loaded.parsedGraph.spawnedChildren) {
    let childEntry: SessionGraphLocatorEntry | null = null;
    let childLoaded: LoadedSession | null = null;
    let childLoadError: string | null = null;
    if (link.agentId) {
      try {
        childEntry = getSessionEntryById(locator, link.agentId);
        childLoaded = childEntry ? await loadSessionFromEntry(childEntry) : null;
      } catch (error) {
        childLoadError = error instanceof Error ? error.message : String(error);
      }
    }
    rows.push({
      link,
      childEntry,
      childLoaded,
      childLoadError,
      latestWaitEvent: getLatestWaitEvent(loaded.parsedGraph, link.agentId),
      latestAssistantMessage: childLoaded
        ? selectLatestCanonicalMessage(childLoaded.parsedCore, 'assistant', null)
        : null,
      latestFinalAnswer: childLoaded
        ? selectLatestCanonicalMessage(childLoaded.parsedCore, 'assistant', 'final_answer')
        : null,
    });
  }
  return rows;
};

const buildSubagentRowResult = (row: SubagentCommandRow) => ({
  agentId: row.link.agentId,
  nickname:
    row.link.nickname ??
    (row.childLoaded ? getResolvedAgentNickname(row.childLoaded) : row.childEntry?.agentNickname) ??
    null,
  agentType: row.link.agentType,
  model: row.link.model,
  reasoningEffort: row.link.reasoningEffort,
  forkContext: row.link.forkContext,
  spawnedAt: row.link.spawnedAt,
  spawnCallId: row.link.spawnCallId,
  dispatchPrompt: row.link.dispatchPrompt,
  latestWaitStatus: row.link.latestWaitStatus,
  latestWaitEvent: buildWaitEventRecord(row.latestWaitEvent),
  latestNotification: buildNotificationRecord(row.link.latestNotification),
  childLoadError: row.childLoadError,
  childSession: row.childLoaded
    ? buildSessionRecord(row.childLoaded)
    : row.childEntry
      ? {
          ...buildLocatorEntryRecord(row.childEntry),
          workspace: null,
          startedAt: null,
          endedAt: null,
          turnCount: null,
          toolCallCount: null,
          firstUserMessage: null,
          parseWarnings: [],
        }
      : null,
  latestAssistantMessage: row.latestAssistantMessage ? buildCanonicalMessageRecord(row.latestAssistantMessage) : null,
  latestFinalAnswer: row.latestFinalAnswer ? buildCanonicalMessageRecord(row.latestFinalAnswer) : null,
});

const buildSubagentsResult = (locator: SessionGraphLocator, loaded: LoadedSession, rows: SubagentCommandRow[]) => {
  const sessionId = getResolvedSessionId(loaded) ?? loaded.locatorEntry.sessionId;
  return {
    command: 'subagents',
    session: buildSessionRecord(loaded),
    counts: {
      spawnCalls: loaded.parsedGraph.spawnCalls.length,
      spawnedChildren: loaded.parsedGraph.spawnedChildren.length,
      resolvableChildSessions: sessionId ? getChildSessionEntries(locator, sessionId).length : 0,
      parentSideNotifications: loaded.parsedGraph.notifications.length,
    },
    subagents: rows.map(buildSubagentRowResult),
  };
};

const printSubagents = (locator: SessionGraphLocator, loaded: LoadedSession, rows: SubagentCommandRow[]) => {
  const sessionId = getResolvedSessionId(loaded) ?? loaded.locatorEntry.sessionId;
  const resolvableChildren = sessionId ? getChildSessionEntries(locator, sessionId) : [];
  const lines = [
    `Session ID: ${formatOptional(sessionId)}`,
    `Path: ${loaded.locatorEntry.path}`,
    `Source: ${getResolvedSourceKind(loaded)}`,
    `Tool Calls: ${loaded.parsedCore.summary.toolCallCount}`,
    `Spawn Calls: ${loaded.parsedGraph.spawnCalls.length}`,
    `Spawned Children: ${loaded.parsedGraph.spawnedChildren.length}`,
    `Resolvable Child Sessions: ${resolvableChildren.length}`,
    `Parent-Side Notifications: ${loaded.parsedGraph.notifications.length}`,
  ];

  console.log(lines.join('\n'));

  if (rows.length === 0) {
    console.log('\nNo spawned children found.');
    return;
  }

  for (const [index, row] of rows.entries()) {
    const childSessionId = row.childLoaded
      ? getResolvedSessionId(row.childLoaded)
      : (row.childEntry?.sessionId ?? row.link.agentId);
    const childNickname =
      row.link.nickname ??
      (row.childLoaded ? getResolvedAgentNickname(row.childLoaded) : row.childEntry?.agentNickname) ??
      null;
    const childSource = row.childLoaded ? getResolvedSourceKind(row.childLoaded) : row.childEntry?.sourceKind;
    const childParentSessionId = row.childLoaded
      ? getResolvedParentSessionId(row.childLoaded)
      : (row.childEntry?.parentSessionId ?? null);

    const childLines: string[] = [
      `Subagent ${index + 1}:`,
      `  Agent ID: ${formatOptional(row.link.agentId)}`,
      `  Nickname: ${formatOptional(childNickname)}`,
      `  Agent Type: ${formatOptional(row.link.agentType)}`,
      `  Model: ${formatOptional(row.link.model)}`,
      `  Reasoning Effort: ${formatOptional(row.link.reasoningEffort)}`,
      `  Fork Context: ${formatOptional(row.link.forkContext)}`,
      `  Spawned At: ${formatOptional(row.link.spawnedAt)}`,
      `  Child Session ID: ${formatOptional(childSessionId)}`,
      `  Child Session Path: ${formatOptional(row.childEntry?.path)}`,
      `  Child Source: ${formatOptional(childSource)}`,
      `  Child Parent Session ID: ${formatOptional(childParentSessionId)}`,
      `  Child Load Error: ${formatOptional(row.childLoadError)}`,
      `  Latest Wait Timestamp: ${formatOptional(row.latestWaitEvent?.timestamp)}`,
      `  Latest Wait Timed Out: ${formatOptional(row.latestWaitEvent?.timedOut)}`,
      `  Latest Notification Timestamp: ${formatOptional(row.link.latestNotification?.timestamp)}`,
    ];

    pushBlock(childLines, 'Dispatch Prompt', row.link.dispatchPrompt, '  ');
    pushBlock(childLines, 'Child First User Message', row.childLoaded?.parsedCore.summary.preview, '  ');
    pushBlock(childLines, 'Latest Wait Status', formatUnknownValue(row.link.latestWaitStatus), '  ');
    pushBlock(
      childLines,
      'Latest Parent Notification Status',
      formatUnknownValue(row.link.latestNotification?.status),
      '  ',
    );

    childLines.push(`  Latest Assistant Timestamp: ${formatOptional(row.latestAssistantMessage?.timestamp)}`);
    childLines.push(`  Latest Assistant Phase: ${formatOptional(row.latestAssistantMessage?.phase)}`);
    pushBlock(childLines, 'Latest Assistant Message', row.latestAssistantMessage?.content, '  ');

    childLines.push(`  Latest Final Answer Timestamp: ${formatOptional(row.latestFinalAnswer?.timestamp)}`);
    pushBlock(childLines, 'Latest Final Answer', row.latestFinalAnswer?.content, '  ');

    console.log('');
    console.log(childLines.join('\n'));
  }
};

const runSubagents = async (args: string[], options: CommandOptions) => {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(SUBAGENTS_HELP_TEXT);
    return;
  }

  const session = parseSingleSessionArgument(args, 'subagents');
  const { locator, loaded } = await loadSession(session);
  maybePrintParseWarnings(loaded, options);

  const rows = await loadSubagentCommandRows(locator, loaded);
  for (const row of rows) {
    if (!row.childLoaded) continue;
    const childSessionId =
      getResolvedSessionId(row.childLoaded) ?? row.childEntry?.sessionId ?? row.link.agentId ?? 'unknown';
    maybePrintParseWarnings(row.childLoaded, options, `child session ${childSessionId}`);
  }

  if (options.json) {
    emitJson(buildSubagentsResult(locator, loaded, rows));
    return;
  }

  printSubagents(locator, loaded, rows);
};

const printParent = (childLoaded: LoadedSession, parentLoaded: LoadedSession) => {
  const childSessionId = getResolvedSessionId(childLoaded) ?? childLoaded.locatorEntry.sessionId;
  const parentSessionId = getResolvedSessionId(parentLoaded) ?? parentLoaded.locatorEntry.sessionId;
  const lines = [
    `Child Session ID: ${formatOptional(childSessionId)}`,
    `Child Path: ${childLoaded.locatorEntry.path}`,
    `Child Source: ${getResolvedSourceKind(childLoaded)}`,
    `Child Parent Session ID: ${formatOptional(getResolvedParentSessionId(childLoaded))}`,
    `Child Nickname: ${formatOptional(getResolvedAgentNickname(childLoaded))}`,
    `Parent Session ID: ${formatOptional(parentSessionId)}`,
    `Parent Path: ${parentLoaded.locatorEntry.path}`,
    `Parent Source: ${getResolvedSourceKind(parentLoaded)}`,
    `Parent Workspace: ${formatOptional(parentLoaded.parsedCore.summary.cwd)}`,
    `Parent Started At: ${formatOptional(parentLoaded.parsedCore.summary.startedAt)}`,
    `Parent Ended At: ${formatOptional(parentLoaded.parsedCore.summary.endedAt)}`,
    `Parent Turns: ${formatOptional(parentLoaded.parsedCore.summary.turnCount)}`,
    `Parent Tool Calls: ${parentLoaded.parsedCore.summary.toolCallCount}`,
    `Parent Spawned Children: ${parentLoaded.parsedGraph.spawnedChildren.length}`,
    `Parent-Side Notifications: ${parentLoaded.parsedGraph.notifications.length}`,
  ];

  console.log(lines.join('\n'));

  if (parentLoaded.parsedCore.summary.preview) {
    console.log('\nParent First User Message:');
    console.log(indentBlock(parentLoaded.parsedCore.summary.preview));
  }
};

const buildParentResult = (childLoaded: LoadedSession, parentLoaded: LoadedSession) => ({
  command: 'parent',
  child: buildSessionRecord(childLoaded),
  parent: {
    ...buildSessionRecord(parentLoaded),
    spawnedChildren: parentLoaded.parsedGraph.spawnedChildren.length,
    parentSideNotifications: parentLoaded.parsedGraph.notifications.length,
  },
});

const runParent = async (args: string[], options: CommandOptions) => {
  if (args.includes('--help') || args.includes('-h')) {
    console.log(PARENT_HELP_TEXT);
    return;
  }

  const session = parseSingleSessionArgument(args, 'parent');
  const { locator, loaded: childLoaded } = await loadSession(session);
  maybePrintParseWarnings(childLoaded, options);

  const childSessionId = getResolvedSessionId(childLoaded) ?? childLoaded.locatorEntry.sessionId;
  const parentSessionId = getResolvedParentSessionId(childLoaded);
  if (!childSessionId) {
    throw new CliError(`Session ${childLoaded.locatorEntry.path} does not declare a session ID.`);
  }
  if (!parentSessionId) {
    throw new CliError(`Session ${childSessionId} does not declare a parent session.`);
  }

  const parentEntry = getSessionEntryById(locator, parentSessionId);
  if (!parentEntry) {
    throw new CliError(`Parent session ${parentSessionId} for child session ${childSessionId} was not found.`);
  }

  const parentLoaded = await loadSessionFromEntry(parentEntry);
  maybePrintParseWarnings(parentLoaded, options, `parent session ${parentSessionId}`);
  if (options.json) {
    emitJson(buildParentResult(childLoaded, parentLoaded));
    return;
  }
  printParent(childLoaded, parentLoaded);
};

const rawProcessArgs = process.argv.slice(2);
const parsedProcessArgs = extractJsonFlag(rawProcessArgs);

const main = async () => {
  const parsedArgs = parsedProcessArgs;
  const args = parsedArgs.args;
  const options: CommandOptions = { json: parsedArgs.json };

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(GLOBAL_HELP_TEXT);
    return;
  }

  const [command, ...rest] = args;

  if (command === 'overview') {
    await runOverview(rest, options);
    return;
  }

  if (command === 'show') {
    await runShow(rest, options);
    return;
  }

  if (command === 'subagents') {
    await runSubagents(rest, options);
    return;
  }

  if (command === 'parent') {
    await runParent(rest, options);
    return;
  }

  throw new CliUsageError(`Unknown command: ${command}`);
};

const { json: jsonOutput } = parsedProcessArgs;

try {
  await main();
} catch (error) {
  if (error instanceof CliError) {
    if (jsonOutput) {
      process.stderr.write(
        `${JSON.stringify(
          {
            error: {
              name: error.name,
              message: error.message,
              exitCode: error.exitCode,
            },
          },
          null,
          2,
        )}\n`,
      );
    } else {
      console.error(error.message);
    }
    process.exit(error.exitCode);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput) {
    process.stderr.write(
      `${JSON.stringify(
        {
          error: {
            name: error instanceof Error ? error.name : 'Error',
            message,
            exitCode: 1,
          },
        },
        null,
        2,
      )}\n`,
    );
  } else {
    console.error(message);
  }
  process.exit(1);
}
