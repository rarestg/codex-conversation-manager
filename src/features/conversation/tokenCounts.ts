import { formatJsonValue } from './format';
import type { ParsedItem, Turn } from './types';

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const clampPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const formatPercent = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.round(value * 10) / 10;
};

export interface TokenUsageSummary {
  inputTokens?: number | null;
  cachedTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  totalTokens?: number | null;
  cacheHitRate?: number | null;
}

export interface RateLimitSummary {
  usedPercent?: number | null;
  windowMinutes?: number | null;
  resetsAt?: number | null;
}

export interface TokenCountSummary {
  totalUsage?: TokenUsageSummary | null;
  lastUsage?: TokenUsageSummary | null;
  contextWindowSize?: number | null;
  contextUsagePercent?: number | null;
  rateLimits: {
    primary?: RateLimitSummary | null;
    secondary?: RateLimitSummary | null;
    credits?: {
      hasCredits?: boolean | null;
      unlimited?: boolean | null;
      balance?: number | null;
    } | null;
    planType?: string | null;
  };
}

const parseTokenUsage = (value: unknown): TokenUsageSummary | null => {
  const obj = asRecord(value);
  const inputTokens = toNumber(obj.input_tokens);
  const cachedTokens = toNumber(obj.cached_input_tokens);
  const outputTokens = toNumber(obj.output_tokens);
  const reasoningTokens = toNumber(obj.reasoning_output_tokens);
  let totalTokens = toNumber(obj.total_tokens);
  if (totalTokens === null) {
    const parts = [inputTokens, outputTokens, reasoningTokens].filter((item) => item !== null) as number[];
    if (parts.length) {
      totalTokens = parts.reduce((sum, item) => sum + item, 0);
    }
  }
  let cacheHitRate: number | null = null;
  if (inputTokens !== null) {
    if (inputTokens === 0) {
      cacheHitRate = 0;
    } else if (cachedTokens !== null && inputTokens > 0) {
      cacheHitRate = cachedTokens / inputTokens;
    }
  }
  const hasAny =
    inputTokens !== null ||
    cachedTokens !== null ||
    outputTokens !== null ||
    reasoningTokens !== null ||
    totalTokens !== null;
  if (!hasAny) return null;
  return {
    inputTokens,
    cachedTokens,
    outputTokens,
    reasoningTokens,
    totalTokens,
    cacheHitRate,
  };
};

const parseRateLimit = (value: unknown): RateLimitSummary | null => {
  const obj = asRecord(value);
  const usedPercent = clampPercent(toNumber(obj.used_percent));
  const windowMinutes = toNumber(obj.window_minutes);
  const resetsAt = toNumber(obj.resets_at);
  if (usedPercent === null && windowMinutes === null && resetsAt === null) return null;
  return { usedPercent, windowMinutes, resetsAt };
};

export const parseTokenCountEntry = (raw: unknown): TokenCountSummary | null => {
  const resolvedRaw = (() => {
    if (typeof raw !== 'string') return raw;
    try {
      return JSON.parse(raw);
    } catch (_error) {
      return raw;
    }
  })();
  const entry = asRecord(resolvedRaw);
  const payload = asRecord(entry.payload ?? entry);
  const info = asRecord(payload.info);
  const totalUsage = parseTokenUsage(info.total_token_usage);
  const lastUsage = parseTokenUsage(info.last_token_usage);
  const contextWindowSize = toNumber(info.model_context_window);
  const contextUsagePercent =
    contextWindowSize !== null && totalUsage?.totalTokens !== null && totalUsage?.totalTokens !== undefined
      ? clampPercent((totalUsage.totalTokens / contextWindowSize) * 100)
      : null;
  const rateLimits = asRecord(payload.rate_limits);
  const primary = parseRateLimit(rateLimits.primary);
  const secondary = parseRateLimit(rateLimits.secondary);
  const credits = asRecord(rateLimits.credits);
  const hasCredits = typeof credits.has_credits === 'boolean' ? credits.has_credits : null;
  const unlimited = typeof credits.unlimited === 'boolean' ? credits.unlimited : null;
  const balance = toNumber(credits.balance);
  const planType = typeof rateLimits.plan_type === 'string' ? rateLimits.plan_type : null;

  const hasAny =
    totalUsage !== null ||
    lastUsage !== null ||
    contextWindowSize !== null ||
    primary !== null ||
    secondary !== null ||
    hasCredits !== null ||
    unlimited !== null ||
    balance !== null ||
    planType !== null;
  if (!hasAny) return null;

  return {
    totalUsage,
    lastUsage,
    contextWindowSize,
    contextUsagePercent,
    rateLimits: {
      primary,
      secondary,
      credits:
        hasCredits !== null || unlimited !== null || balance !== null
          ? {
              hasCredits,
              unlimited,
              balance,
            }
          : null,
      planType,
    },
  };
};

export const formatTokenValue = (value?: number | null) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  const abs = Math.abs(value);
  if (abs < 1000) return `${Math.round(value)}`;
  if (abs < 1_000_000) {
    const formatted = (value / 1000).toFixed(1);
    return `${formatted.replace(/\.0$/, '')}k`;
  }
  const formatted = (value / 1_000_000).toFixed(1);
  return `${formatted.replace(/\.0$/, '')}m`;
};

export const formatCreditsSummary = (
  credits?: TokenCountSummary['rateLimits']['credits'] | null,
  planType?: string | null,
) => {
  const parts: string[] = [];
  if (planType) parts.push(`Plan: ${planType}`);
  if (credits?.hasCredits !== null && credits?.hasCredits !== undefined) {
    parts.push(`Credits: ${credits.hasCredits ? 'yes' : 'no'}`);
  }
  if (credits?.unlimited !== null && credits?.unlimited !== undefined) {
    parts.push(`Unlimited: ${credits.unlimited ? 'yes' : 'no'}`);
  }
  if (credits?.balance !== null && credits?.balance !== undefined) {
    parts.push(`Balance: ${credits.balance}`);
  }
  return parts.length ? parts.join(' · ') : null;
};

export const findLastTokenCountItem = (turns: Turn[]) => {
  let last: ParsedItem | null = null;
  for (const turn of turns) {
    for (const item of turn.items) {
      if (item.type === 'token_count') last = item;
    }
  }
  return last;
};

export const buildTokenCountExport = (raw: unknown) => {
  const parsed = parseTokenCountEntry(raw);
  if (!parsed) return formatJsonValue(raw);

  const totalUsage = parsed.totalUsage ?? {};
  const lastUsage = parsed.lastUsage ?? {};
  const payload: Record<string, unknown> = {};

  const totalUsagePayload: Record<string, unknown> = {};
  if (totalUsage.totalTokens !== null && totalUsage.totalTokens !== undefined) {
    totalUsagePayload.total_tokens = totalUsage.totalTokens;
  }
  if (totalUsage.inputTokens !== null && totalUsage.inputTokens !== undefined) {
    totalUsagePayload.input_tokens = totalUsage.inputTokens;
  }
  if (totalUsage.cachedTokens !== null && totalUsage.cachedTokens !== undefined) {
    totalUsagePayload.cached_input_tokens = totalUsage.cachedTokens;
  }
  if (totalUsage.outputTokens !== null && totalUsage.outputTokens !== undefined) {
    totalUsagePayload.output_tokens = totalUsage.outputTokens;
  }
  if (totalUsage.reasoningTokens !== null && totalUsage.reasoningTokens !== undefined) {
    totalUsagePayload.reasoning_output_tokens = totalUsage.reasoningTokens;
  }
  if (Object.keys(totalUsagePayload).length) payload.total_usage = totalUsagePayload;

  const lastUsagePayload: Record<string, unknown> = {};
  if (lastUsage.totalTokens !== null && lastUsage.totalTokens !== undefined) {
    lastUsagePayload.total_tokens = lastUsage.totalTokens;
  }
  if (lastUsage.inputTokens !== null && lastUsage.inputTokens !== undefined) {
    lastUsagePayload.input_tokens = lastUsage.inputTokens;
  }
  if (lastUsage.cachedTokens !== null && lastUsage.cachedTokens !== undefined) {
    lastUsagePayload.cached_input_tokens = lastUsage.cachedTokens;
  }
  if (lastUsage.outputTokens !== null && lastUsage.outputTokens !== undefined) {
    lastUsagePayload.output_tokens = lastUsage.outputTokens;
  }
  if (lastUsage.reasoningTokens !== null && lastUsage.reasoningTokens !== undefined) {
    lastUsagePayload.reasoning_output_tokens = lastUsage.reasoningTokens;
  }
  if (Object.keys(lastUsagePayload).length) payload.last_usage = lastUsagePayload;

  if (parsed.contextWindowSize !== null && parsed.contextWindowSize !== undefined) {
    payload.model_context_window = parsed.contextWindowSize;
  }
  if (parsed.contextUsagePercent !== null && parsed.contextUsagePercent !== undefined) {
    payload.context_used_percent = formatPercent(parsed.contextUsagePercent);
  }

  const rateLimitsPayload: Record<string, unknown> = {};
  if (parsed.rateLimits.primary) {
    rateLimitsPayload.primary = {
      used_percent: parsed.rateLimits.primary.usedPercent ?? null,
      window_minutes: parsed.rateLimits.primary.windowMinutes ?? null,
      resets_at: parsed.rateLimits.primary.resetsAt ?? null,
    };
  }
  if (parsed.rateLimits.secondary) {
    rateLimitsPayload.secondary = {
      used_percent: parsed.rateLimits.secondary.usedPercent ?? null,
      window_minutes: parsed.rateLimits.secondary.windowMinutes ?? null,
      resets_at: parsed.rateLimits.secondary.resetsAt ?? null,
    };
  }
  if (parsed.rateLimits.credits) {
    rateLimitsPayload.credits = {
      has_credits: parsed.rateLimits.credits.hasCredits ?? null,
      unlimited: parsed.rateLimits.credits.unlimited ?? null,
      balance: parsed.rateLimits.credits.balance ?? null,
    };
  }
  if (parsed.rateLimits.planType !== null && parsed.rateLimits.planType !== undefined) {
    rateLimitsPayload.plan_type = parsed.rateLimits.planType;
  }
  if (Object.keys(rateLimitsPayload).length) payload.rate_limits = rateLimitsPayload;

  return formatJsonValue(payload);
};
