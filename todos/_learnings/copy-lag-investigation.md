# Copy Lag Investigation — Findings & Learnings

## Summary

We investigated severe UI lag and repeated console violations (“[Violation] 'message' handler took …ms”) that occurred when clicking copy buttons (session ID / message copy). The copy operations themselves are fast, but the UI felt sluggish because every copy update triggered a **full-page re-render**. The re-render cost is dominated by heavy components (`Sidebar`/`SessionsPanel`/`TurnList`), which consistently took hundreds of milliseconds. The core issue is **top-level state changes (copiedId)** combined with **unstable handler identities** causing expensive subtrees to re-render.

This document captures all changes made during the investigation, the logging infrastructure added, and the evidence from logs that confirms the root cause.

---

## Problem Statement

Symptoms observed in dev:
- Clicking any copy button takes ~0.5–1s to show the “Copied” UI feedback.
- Console shows repeated `[Violation] 'message' handler took …ms` warnings on copy.
- Cursor hover state changes are delayed, and click handlers feel sluggish.

We confirmed that the initial infinite update loop was fixed (see earlier changes). The remaining lag is dominated by heavy re-renders on copy actions.

---

## Code Changes Made During Investigation

### 1) Fixed the infinite render loop in `useSession`

**Files changed:**
- `src/features/conversation/hooks/useSession.ts`

**What changed:**
- Replaced `activeSession` state with minimal source-of-truth state:
  - `activeSessionId` (string | null)
  - `parsedMeta` (preview/startedAt/endedAt/turnCount/filename)
- Derived `activeSession` via `useMemo` (instead of syncing in an effect).
- Removed the effect that depended on `activeSession` and called `setActiveSession` (the loop).

**Why it matters:**
- Prevents “Maximum update depth exceeded” errors.
- Stops background re-render loops that were occurring even when idle.

---

### 2) Added DEV-only render instrumentation

#### New hook: `useRenderDebug`
**File added:**
- `src/features/conversation/hooks/useRenderDebug.ts`

**What it does:**
- Logs render counts and summarizes **which tracked props changed** per render.
- Dev-only (`import.meta.env.DEV` guard).

#### New hook: `useWhyDidYouRender`
**File added:**
- `src/features/conversation/hooks/useWhyDidYouRender.ts`

**What it does:**
- Logs prop-level diffs between renders, including functions if `includeFunctions: true`.
- Summarizes complex values (arrays/objects) to avoid log spam.
- Dev-only.

#### Where we attached `useRenderDebug` and cost timing
- `src/features/conversation/ConversationViewer.tsx`
- `src/features/conversation/components/Sidebar.tsx`
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/TurnList.tsx`
- `src/features/conversation/components/SessionHeader.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`

#### Render cost logging
- `SessionsPanel`: logs `[render cost] SessionsPanel` with `performance.now()` duration.
- `TurnList`: logs `[render cost] TurnList` with duration.
- `Sidebar`: logs `[render cost] Sidebar` with duration (using `requestAnimationFrame`).

#### MessageCard sampling log
- `src/features/conversation/components/MessageCard.tsx`
- Logs a single message per turn (`itemIndex === 0`) to show whether message cards re-render on copy.

---

### 3) Added copy pipeline timing

**File changed:**
- `src/features/conversation/ConversationViewer.tsx`

**What we added:**
- `console.time` / `console.timeEnd` around:
  - `markdownToPlainText`
  - `copyText`
  - `showCopied`
  - Total time per copy action

This confirms whether the copy itself is slow (it isn’t).

---

### 4) Dev-only copy lifecycle logs

**File changed:**
- `src/features/conversation/hooks/useCopyFeedback.ts`

**What we added:**
- `console.debug` logs on `showCopied` and `clearCopied`.

---

### 5) StrictMode temporarily disabled for clean logs

**File changed:**
- `src/main.tsx`

**What changed:**
- Removed `<React.StrictMode>` to avoid double-render noise during logging.
- Removed unused `React` import (TS lint).

---

### 6) Vite type definitions

**File added:**
- `src/vite-env.d.ts`

**Why:**
- Fixes `TS2339: Property 'env' does not exist on type 'ImportMeta'` due to `import.meta.env.DEV` checks.

---

## Key Log Results (and what they prove)

Below are the critical log findings and their interpretations.

### A) Copy pipeline is fast (not the issue)

**Copy session ID log:**
- `copyText: ~0.9ms`
- `showCopied: ~0.24ms`
- `total: ~1.3ms`

**Copy message as text log:**
- `markdownToPlainText: ~9.9ms`
- `copyText: ~0.6ms`
- `total: ~10.8ms`

**Interpretation:**
Copy operations themselves are fast. The lag happens **after** `showCopied` because React re-renders heavy subtrees.

---

### B) Render cost dominates (~400–500ms per click)

**Observed render costs on copy:**
- `Sidebar`: ~440–520ms
- `SessionsPanel`: ~450–540ms
- `TurnList`: ~200–230ms

**Interpretation:**
These heavy renders happen twice (on `showCopied` and on `clearCopied`). This is the primary cause of UI lag and `[Violation] 'message' handler …` warnings.

---

### C) Why re-renders happen (prop diffs)

**Why-did-you-render logs showed:**
- `Sidebar` rerender triggered by `onClearWorkspace` function identity change.
- `TurnList` rerender triggered by `copiedId` change and `onCopyItem` identity change.

**Interpretation:**
The top-level `copiedId` state lives in `ConversationViewer`, so any copy updates cause a full tree render. Unstable handler identities (created inline each render) prevent memoization and force expensive subtrees to re-render even though their data is unchanged.

---

## Conclusions

1. **The delay is not the copy operation itself.**
   It’s a UI re-render problem caused by state living too high in the tree.

2. **Copy feedback state should be colocated.**
   `copiedId` stored in `ConversationViewer` forces expensive re-renders everywhere.

3. **Unstable handler identities amplify the cost.**
   `onClearWorkspace` and `onCopyItem` are recreated each render, causing re-renders even when data didn’t change.

---

## What This Implies for the Fix

The best long-term fix should:
- **Move copy feedback state down** into `SessionHeader` and `MessageCard` (or a dedicated `CopyButton`).
- **Memoize heavy components** (`Sidebar`, `SessionsPanel`, `TurnList`) and stabilize their props with `useCallback`.
- Keep data state (sessions, turns) high, but keep ephemeral UI state (copied feedback) local.

This architecture prevents the entire app from re-rendering on a tiny UI interaction and eliminates the lag.

---

## Files and Logging Summary (Quick Reference)

**Added:**
- `src/features/conversation/hooks/useRenderDebug.ts`
- `src/features/conversation/hooks/useWhyDidYouRender.ts`
- `src/vite-env.d.ts`

**Modified:**
- `src/features/conversation/hooks/useSession.ts`
- `src/features/conversation/ConversationViewer.tsx`
- `src/features/conversation/components/SessionsPanel.tsx`
- `src/features/conversation/components/Sidebar.tsx`
- `src/features/conversation/components/TurnList.tsx`
- `src/features/conversation/components/SessionHeader.tsx`
- `src/features/conversation/components/WorkspacesPanel.tsx`
- `src/features/conversation/components/MessageCard.tsx`
- `src/features/conversation/hooks/useCopyFeedback.ts`
- `src/main.tsx`

This logging scaffolding can be removed or disabled after implementing the fix.
