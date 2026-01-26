# CopyButton API (Copy UX standard)

Purpose
- Provide a single, reusable copy control with consistent UX: whole-surface click, no layout shift, and accessible feedback.
- Standardizes copy behavior across SessionHeader A/B, MessageCard, SessionsPanel, etc.

Where it lives
- `src/features/conversation/components/CopyButton.tsx`
- Uses `useCopyFeedback` and `copyText` (`src/features/conversation/hooks/useCopyFeedback.ts`, `src/features/conversation/copy.ts`)

Core behavior
- Click anywhere on the control to copy (no nested interactive elements).
- Labels swap via overlay (idle / hover / copied / failed) without changing width.
- Copy success/failure is announced via an `aria-live="polite"` region.
- Defaults to green check on success and red X on failure (icons are inline with the copied/failed labels).

How to use
Choose exactly one copy source:
- `text="literal string"` (simple, synchronous)
- `getText={() => string | Promise<string>}` (lazy, async)
- `onCopy={() => boolean | undefined | Promise<boolean | undefined>}` (custom copy logic)

Typical examples
```tsx
// Simple copy
<CopyButton text={sessionId} idleLabel={sessionId} ariaLabel="Copy session id" />

// Lazy copy (compute on click)
<CopyButton getText={() => buildConversationExport(turns)} idleLabel="Copy conversation" />

// Custom copy behavior
<CopyButton onCopy={() => doCustomCopy()} idleLabel="Copy" />
```

Label props
- `idleLabel` (required): default visible label.
- `hoverLabel` (optional): defaults to "Copy"; set to `null` to disable hover swapping.
- `copiedLabel` (optional): defaults to "Copied!".
- `failedLabel` (optional): defaults to "Failed".
- `reserveLabel` (optional): width anchor; defaults to the widest known label (string labels only) to prevent layout shifts.
- Hover/copied/failed labels intentionally render without truncation so they can overflow the reserved width if needed.

Icons
- `copiedIcon` (optional): inline icon appended to the copied label (defaults to a green check).
- `failedIcon` (optional): inline icon appended to the failed label (defaults to a red X).
- Set either to `null` to render the label without an icon.

Accessibility notes
- All visible labels are `aria-hidden` for clean screen-reader output.
- Always provide `ariaLabel` if `idleLabel` is not a string (e.g. JSX or complex layout).
- If `ariaLabel` is omitted and `idleLabel` is a string, it becomes the accessible name.
- Live region uses `<output aria-live="polite">` and announces "Copied!" / "Copy failed".
- Hover feedback is mirrored on `:focus-visible` for keyboard users.

Error semantics
- `copyText` returns `boolean` (true on success, false on failure).
- For `onCopy`, any return value except `false` is treated as success.
- In dev mode, if `onCopy` returns `false`, a console warning logs the button's aria label.

Things to watch out for
- Avoid nested interactive elements. If you make a whole pill clickable, remove inner buttons/icons.
- Keep copy work lazy for expensive data (use `getText`).
- If `hoverLabel={null}`, idle text will remain visible on hover (no fade-out).
- If you disable hover labels, ensure the idle label is clear enough.
