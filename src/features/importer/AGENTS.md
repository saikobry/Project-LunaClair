# src/features/importer/ — Content Importer Feature
 
## Purpose

User-facing 5-step import wizard allowing learners to ingest external study materials (PDFs, photos of notes), review and edit Markdown via Lexical Writer, optionally clean up text with AI diff comparison, assign materials to subjects/terms, and persist to local library storage with original asset preservation.

## Ownership

- `ImporterScreen.tsx` — Main feature screen and 5-step wizard orchestrator (`selecting` → `extracting` → `review` → `details` → `completed`).
- `components/`
  - `ImportDropZone.tsx` — Drag-and-drop file ingestion zone with format pill hints and file validation.
  - `ImportFileCard.tsx` — File queue card with status badges, size, progress %, and remove/retry actions.
  - `ExtractionProgressView.tsx` — Multi-file extraction progress bar with active phase labels and cancellation.
  - `ImportReviewView.tsx` — Adaptive dual-pane review layout embedding Lexical `WriterEditor` and `MarkdownViewer` with per-page confidence badges.
  - `AiCleanupDiffView.tsx` — Opt-in AI cleanup diff comparison with side-by-side or stacked views and Accept/Reject actions.
  - `MaterialDetailsView.tsx` — Title, Subject, and Academic Term assignment step.
  - `ImportResultView.tsx` — Success confirmation with "Open Material" links and failed retry options.
  - `PasswordPromptDialog.tsx` — Dialog handling encrypted / password-protected PDFs.
- `hooks/`
  - `useImportSession.ts` — 5-step state machine with bounded concurrency (max 2 concurrent extraction jobs) and `AbortController` cancellation per candidate.
  - `useAiCleanup.ts` — Opt-in AI markdown cleanup hook managing clean, accept, and reject states.
  - `useImporterContext.ts` — Dependency injection consumer for application use cases.
- `styles/importer.stylex.ts` — StyleX styles for wizard, drop zone, review layout, cards, and diff modals.

## Local Contracts

- Importer is code-split and lazy-loaded via `React.lazy` behind `/import` route to keep main app bundle lean.
- Direct-path feature contracts only (ADR-010): consumes `WriterEditor` from `src/features/writer/components/WriterEditor`, `MarkdownViewer` from `src/features/reader/components/MarkdownViewer`, and catalog query hooks from `src/features/catalog/`.
- Concurrency limit: extraction queue runs with a maximum of 2 parallel worker jobs to avoid browser memory pressure.
- User-in-the-loop: AI cleanup is strictly opt-in and generates a visual diff; AI never silently modifies extracted text without explicit Accept.

## Work Guidance

- Keep UI free from direct IndexedDB or Tesseract/PDF.js calls — route all work through application use cases.

## Verification

- `npx vitest run src/features/importer` — Feature orchestrator, 5-step wizard state machine, hooks, and component tests.
- `npm run test:run` — Repo-wide unit, application, domain, and feature test execution.
- `npm run build`
- `npm run lint`

## Child DOX Index

- None.
