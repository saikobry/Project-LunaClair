# src/features/importer/ — Content Importer Feature
 
## Purpose

User-facing 5-step import wizard allowing learners to ingest external study materials (PDFs, photos of notes), review and edit Markdown via Lexical Writer, optionally clean up text with AI diff comparison, and persist to local library storage with original asset preservation.

## Ownership

- `ImporterScreen.tsx` — Main feature screen and 5-step wizard orchestrator (`selecting` → `extracting` → `review` → `details` → `completed`).
- `components/`
  - `ImportDropZone.tsx` — Drag-and-drop file ingestion zone with format pill hints, file validation, and OCR engine selection (Local Tesseract vs AI Vision MAX, disabled when offline).
  - `ImportFileCard.tsx` — File queue card with status badges, size, progress %, and remove/retry actions.
  - `ExtractionProgressView.tsx` — Multi-file extraction progress bar with active phase labels (page tracking, `ai-vision` visual indication with Sparkles and accent role tokens, rate-limit cooldown countdown) and cancellation.
  - `ImportReviewView.tsx` — Adaptive dual-pane review layout embedding Lexical `WriterEditor` and `MarkdownViewer` with per-page confidence badges, toolbar AI model picker, inline diff comparison modal with Accept/Reject actions, and partial extraction warning banner when `isPartial` is true.
  - `MaterialDetailsView.tsx` — Title assignment step.
  - `ImportResultView.tsx` — Success confirmation with "Open Material" links and failed retry options.
  - `PasswordPromptDialog.tsx` — Dialog handling encrypted / password-protected PDFs.
- `hooks/`
  - `useImportSession.ts` — 5-step state machine with bounded concurrency (max 2 concurrent extraction jobs), `ocrEngine` selection, progress tracking (`progressMap`), and `AbortController` cancellation per candidate (`cancelExtraction`).
  - `useAiCleanup.ts` — Opt-in AI markdown cleanup hook managing clean, accept, reject, candidate-switching abort, and rate-limit cooldown states.
  - `useImporterContext.ts` — Dependency injection consumer for application use cases.
- `styles/importer.stylex.ts` — StyleX styles for wizard, drop zone, review layout, cards, and diff modals.

## Local Contracts

- Importer is code-split and lazy-loaded via `React.lazy` behind `/import` route to keep main app bundle lean.
- Direct-path feature contracts only (ADR-010): consumes `WriterEditor` from `src/features/writer/components/WriterEditor`, `MarkdownViewer` from `src/features/reader/components/MarkdownViewer`, and `useAiModelSelection`/`AiModelPicker` from `src/features/ai/`.
- Concurrency limit: extraction queue runs with a maximum of 2 parallel worker jobs to avoid browser memory pressure.
- User-in-the-loop: AI cleanup is strictly opt-in and generates a visual diff; AI never silently modifies extracted text without explicit Accept. Candidate switching cancels in-flight cleanup and clears diff state; candidateId and original text must match upon acceptance.
- Multimodal Vision Extraction: AI Vision (`ukisai-swift-max`) digitizes scanned PDFs/images directly into structured Markdown tables and formatting. Importers execute AI Vision strictly on `ocrEngine === 'ai-vision'` with zero silent fallback to local Tesseract, emitting `phase: 'ai-vision'` extraction progress and separate `visionPages` statistics. Enforces 12-second pacing between request starts and abortable rate-limit cooldown (429 `retryAfterSeconds`, retrying up to 2 times).
- Cancellation & Partial Result Contract: On user cancellation, ongoing extraction preserves all pages extracted up to page `i-1`, marks `isPartial: true`, and presents the partial document in `ImportReviewView` with a warning banner.
- Local-first offline invariant: Tesseract WASM is the default offline-capable extractor; AI Vision is strictly an opt-in cloud enhancement requiring `navigator.onLine` and MAX availability.

## Work Guidance

- Keep UI free from direct IndexedDB or Tesseract/PDF.js calls — route all work through application use cases.

## Verification

- `npx vitest run src/features/importer` — Feature orchestrator, 5-step wizard state machine, hooks, and component tests.
- `npm run test:run` — Repo-wide unit, application, domain, and feature test execution.
- `npm run build`
- `npm run lint`

## Child DOX Index

- None.
