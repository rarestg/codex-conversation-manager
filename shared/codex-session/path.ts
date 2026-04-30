import path from 'node:path';

export const normalizeCwd = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const normalized = path.normalize(trimmed);
    return path.isAbsolute(normalized) ? path.resolve(normalized) : normalized;
  } catch (_error) {
    return trimmed;
  }
};
