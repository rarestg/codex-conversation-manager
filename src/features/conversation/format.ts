export const MAX_PREVIEW_CHARS = 2000;

export const formatJsonValue = (value: unknown) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
};

export const generateId = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

export const formatTimestamp = (value?: string | null, includeSeconds = true) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
  }).format(date);
};

export const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
};

export const formatTime = (value?: string | null, includeSeconds = false) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
  }).format(date);
};

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getDaysInMonth = (year: string, month: string) => {
  const yearNum = toNumber(year);
  const monthNum = toNumber(month);
  if (!yearNum || !monthNum) return null;
  if (monthNum < 1 || monthNum > 12) return null;
  const days = new Date(yearNum, monthNum, 0).getDate();
  return Number.isFinite(days) ? days : null;
};

export const getDaysInYear = (year: string) => {
  const yearNum = toNumber(year);
  if (!yearNum) return null;
  const isLeapYear = new Date(yearNum, 1, 29).getMonth() === 1;
  return isLeapYear ? 366 : 365;
};

export const formatMonthLabel = (year: string, month: string) => {
  const monthNum = toNumber(month);
  if (!monthNum || monthNum < 1 || monthNum > 12) return month;
  const yearNum = toNumber(year) ?? new Date().getFullYear();
  const date = new Date(yearNum, monthNum - 1, 1);
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long' }).format(date);
  return `${month.padStart(2, '0')} ${monthName}`;
};

export const formatDayLabel = (year: string, month: string, day: string) => {
  const yearNum = toNumber(year);
  const monthNum = toNumber(month);
  const dayNum = toNumber(day);
  if (!yearNum || !monthNum || !dayNum) return day;
  const date = new Date(yearNum, monthNum - 1, dayNum);
  if (Number.isNaN(date.getTime())) return day;
  const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date);
  return `${day.padStart(2, '0')} ${weekday}`;
};

export const formatDuration = (start?: string | null, end?: string | null) => {
  if (!start || !end) return '';
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '';
  const diffMs = endDate.getTime() - startDate.getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return '';
  const totalSeconds = Math.round(diffMs / 1000);
  if (totalSeconds < 60) return '<1m';
  const totalMinutes = Math.round(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) return `${totalMinutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

export const isSameDay = (value: string, compareTo: Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return (
    date.getFullYear() === compareTo.getFullYear() &&
    date.getMonth() === compareTo.getMonth() &&
    date.getDate() === compareTo.getDate()
  );
};

export const formatRelativeTime = (value?: string | null, now = new Date()) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.round(diffMs / 1000);
  const absSeconds = Math.abs(diffSeconds);
  if (absSeconds < 60) return 'just now';
  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) return diffMinutes < 0 ? `${Math.abs(diffMinutes)}m ago` : `in ${diffMinutes}m`;
  const diffHours = Math.round(diffSeconds / 3600);
  return diffHours < 0 ? `${Math.abs(diffHours)}h ago` : `in ${diffHours}h`;
};

const HOME_PATH_REGEX = /^(?:\/Users\/[^/]+|\/home\/[^/]+|[A-Za-z]:\\Users\\[^\\]+)/;

export const formatWorkspacePath = (value?: string | null) => {
  if (!value) return '';
  return value.replace(HOME_PATH_REGEX, '~');
};
