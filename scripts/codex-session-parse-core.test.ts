import assert from 'node:assert/strict';
import test from 'node:test';
import { extractSessionIdFromObject, normalizeSessionId, parseSessionCore } from '../shared/codex-session/parseCore';

test('extractSessionIdFromObject reads snake_case resume session ids', () => {
  assert.equal(extractSessionIdFromObject({ resume_session_id: 'resumed session_abc123' }), 'session_abc123');
});

test('extractSessionIdFromObject reads camelCase resume session ids', () => {
  assert.equal(extractSessionIdFromObject({ resumeSessionId: 'resumed session_def456' }), 'session_def456');
});

test('extractSessionIdFromObject prefers canonical id over resume ids', () => {
  assert.equal(
    extractSessionIdFromObject({
      id: 'session_current1',
      resume_session_id: 'session_previous1',
      resumeSessionId: 'session_previous2',
    }),
    'session_current1',
  );
});

test('normalizeSessionId trims and extracts known id shapes', () => {
  assert.equal(normalizeSessionId('  session_keep123  '), 'session_keep123');
  assert.equal(
    normalizeSessionId('prefix 123e4567-e89b-12d3-a456-426614174000 suffix'),
    '123e4567-e89b-12d3-a456-426614174000',
  );
  assert.equal(normalizeSessionId('  opaque-id  '), 'opaque-id');
});

test('parseSessionCore keeps filename-derived session id over resume metadata', () => {
  const parsed = parseSessionCore({
    sessionPath: '/tmp/2026-04-30T00-00-00-session_canonical1.jsonl',
    raw: `${JSON.stringify({
      type: 'session_meta',
      payload: {
        id: 'session_metadata1',
        resume_session_id: 'session_previous1',
      },
    })}\n`,
  });

  assert.equal(parsed.summary.sessionId, 'session_canonical1');
});
