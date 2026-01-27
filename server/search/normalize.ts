const MAX_FTS_TOKENS = 32;
const MIN_LATIN_TOKEN_LENGTH = 3;
const MIN_NON_LATIN_TOKEN_LENGTH = 1;
const MIN_NUMERIC_TOKEN_LENGTH = 2;
const FTS_TOKEN_REGEX = /[\p{L}\p{N}\p{M}]+/gu;
const LATIN_SCRIPT_REGEX = /\p{Script=Latin}/u;
const NUMERIC_TOKEN_REGEX = /^\p{N}+$/u;

type FtsQueryResult = {
  normalized: string | null;
  tokens: string[];
  truncated: boolean;
};

const isSearchableToken = (token: string) => {
  if (!token) return false;
  if (LATIN_SCRIPT_REGEX.test(token)) {
    return token.length >= MIN_LATIN_TOKEN_LENGTH;
  }
  if (NUMERIC_TOKEN_REGEX.test(token)) {
    return token.length >= MIN_NUMERIC_TOKEN_LENGTH;
  }
  return token.length >= MIN_NON_LATIN_TOKEN_LENGTH;
};

export const normalizeFtsQuery = (raw: string): FtsQueryResult => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { normalized: null, tokens: [], truncated: false };
  }
  const tokens = (trimmed.match(FTS_TOKEN_REGEX) ?? []).filter(Boolean);
  if (tokens.length === 0) {
    return { normalized: null, tokens: [], truncated: false };
  }
  const truncated = tokens.length > MAX_FTS_TOKENS;
  const limitedTokens = tokens.slice(0, MAX_FTS_TOKENS);
  const searchableTokens = limitedTokens.filter(isSearchableToken);
  if (searchableTokens.length === 0) {
    return { normalized: null, tokens: [], truncated: false };
  }
  const escapedTokens = searchableTokens.map((token) => token.replace(/"/g, '""'));
  const normalized = escapedTokens.map((token) => `"${token}"`).join(' AND ');
  return { normalized, tokens: searchableTokens, truncated };
};
