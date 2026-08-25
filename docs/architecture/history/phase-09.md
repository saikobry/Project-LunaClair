# Phase 9 Chronicle — Content Importer

## 1. Executive Summary

- **Status:** Complete (100% of Phase 9 scope delivered, integrated, and verified).
- **Core Objective:** Provide a resilient, local-first content ingestion pipeline that transforms unstructured external study materials (PDF documents, scanned textbook pages, diagrams, photos) into structured, editable Markdown inside Project LunaClair without requiring cloud server processing or manual transcription.
- **Key Architectural Wins:**
  - **Provider-Agnostic Importer Registry Port:** Established extensible domain ports (`ContentImporter`, `ImporterRegistry`, `ExtractionOptions`) decoupling file format detection from specific libraries (`pdfjs-dist`, `tesseract.js`).
  - **6-Pass Pure Markdown Conversion Pipeline:** Built a deterministic, side-effect-free pipeline (`normalizationPass`, `structurePass`, `pageAnchorPass`, `listPass`, `tablePass`, `cleanupPass`) converting raw text into clean GitHub Flavored Markdown (GFM).
  - **Memory-Safe Sequential Extraction & OCR Delegation:** Designed `PdfjsImporter` with sequential single-page rendering (avoiding high memory consumption on 50+ page PDFs) and automated text-density heuristics to delegate scanned pages to `TesseractExtractor`.
  - **Original Binary Asset Preservation:** Added Dexie Schema v10 with `importAssets: 'materialId'`, ensuring original uploaded binaries (PDFs/images) are stored alongside converted Markdown for fidelity, citations, and future cloud sync.
  - **Bounded Concurrency & Cancellation:** Implemented client-side extraction queuing with strict bounded concurrency (max 2 parallel workers) and per-job `AbortController` cancellation.
  - **Lexical Writer & Viewer Reuse:** Embedded standard Lexical `WriterEditor` and `MarkdownViewer` into the Step 3 Review stage, providing unified authoring consistency with `/write`.
  - **Opt-In Non-Destructive AI Cleanup:** Integrated Cloudflare Workers AI with a strict non-summarizing prompt, returning dual-version `{ original, cleaned }` diff comparison before accepting edits.
  - **Code-Split Chunks for PWA Performance:** Applied dynamic `import()` for `pdfjs-dist`, `tesseract.js`, and `ImporterScreen`, keeping the initial PWA app shell under 1.92 MB (586 kB gzip).
  - **100% Test Pass Rate:** Verified across 40 Vitest test suites (224 unit tests) + 14 real Chromium Playwright E2E acceptance tests.

---

## 2. Files Changed Breakdown

### Added

#### Domain Layer (`src/domain/importer/`)
- `ContentImporter.ts` — Importer and registry port interfaces (`ContentImporter`, `ImporterRegistry`, `ExtractionOptions`).
- `importer.types.ts` — Phase 9 domain models (`ImportSession`, `ImportCandidate`, `ExtractionResult`, `PageExtraction`, `ImportMetadata`, `ExtractionStats`, `ExtractionProgress`, `ImportError`, `ImportErrorCode`).
- `ImportAssetRepository.ts` — Port interface for binary asset storage (`ImportedAsset`, `ImportAssetRepository`).
- `markdownConverter/` — 6-pass pure markdown conversion pipeline:
  - `normalizationPass.ts` — Line-ending normalization, Unicode whitespace cleanup, page-break artifact removal.
  - `structurePass.ts` — Heading detection (ALL CAPS, numbered sections, chapters).
  - `pageAnchorPass.ts` — Multi-page anchor injection (`## Page N` + `---`).
  - `listPass.ts` — Bullet and numbered list formatting with indentation support.
  - `tablePass.ts` — Column and key-value alignment conversion to GFM tables.
  - `cleanupPass.ts` — Blank line collapsing, horizontal rule formatting, trailing whitespace cleanup.
  - `index.ts` — Pipeline orchestrator (`convertToMarkdown`).
  - `__tests__/markdownConverter.test.ts` — Unit tests for all 6 pipeline passes.
- `AGENTS.md` — Domain contracts and architecture constraints.

#### Infrastructure Layer (`src/infrastructure/`)
- `importer/PdfjsImporter.ts` — PDF extraction adapter with dynamic `pdfjs-dist` import, worker configuration, text density OCR fallback heuristic, and password error handling.
- `importer/TesseractExtractor.ts` — OCR extraction adapter with dynamic `tesseract.js` import, canvas preprocessing (grayscale, contrast, EXIF rotation), and progress logging.
- `importer/ImageImporter.ts` — Image format adapter supporting PNG, JPG, JPEG, JFIF, HEIC, HEIF, WEBP.
- `importer/DefaultImporterRegistry.ts` — Factory registry assembling format importers.
- `importer/createExtractors.ts` — Composition root extractor factory.
- `database/schema.ts` — Dexie database schema version 10 adding `importAssets: 'materialId'`.
- `database/LunaClairDatabase.ts` — Added `importAssets` table mapping to database class.
- `database/repositories/DexieImportAssetRepository.ts` — Dexie implementation of `ImportAssetRepository`.

#### Application Layer (`src/application/use-cases/importer/`)
- `ExtractContentUseCase.ts` — Extraction orchestrator resolving format importers and executing `convertToMarkdown()`.
- `CommitImportUseCase.ts` — Atomic persistence use case saving `StudyMaterial`, `ImportedDocumentContent`, and `ImportedAsset`.
- `CleanupImportWithAiUseCase.ts` — AI cleanup use case streaming structured Markdown and returning `{ original, cleaned }` diff.
- `__tests__/importerUseCases.test.ts` — Unit tests for extraction, commit, and AI cleanup use cases.

#### Feature UI Layer (`src/features/importer/`)
- `ImporterScreen.tsx` — Top-level 5-step wizard screen orchestrator (`selecting` → `extracting` → `review` → `details` → `completed`).
- `components/ImportDropZone.tsx` — Drag-and-drop and click-to-browse file ingestion zone.
- `components/ImportFileCard.tsx` — File queue item with metadata and status badges.
- `components/ExtractionProgressView.tsx` — Extraction progress tracking with cancel actions.
- `components/ImportReviewView.tsx` — Adaptive dual-pane review layout embedding `WriterEditor`, `MarkdownViewer`, confidence badges, and AI Cleanup toolbar.
- `components/MaterialDetailsView.tsx` — Metadata assignment form (Title, Subject, Term).
- `components/ImportResultView.tsx` — Success view listing imported materials with direct workspace navigation.
- `hooks/useImportSession.ts` — 5-step session state machine with bounded 2-worker extraction queue, cancellation, and query invalidation.
- `hooks/useAiCleanup.ts` — Hook managing AI cleanup state, diff view, and accept/reject actions.
- `hooks/useImporterContext.ts` — Hook retrieving importer use cases from React application context.
- `styles/importer.stylex.ts` — StyleX styles and design tokens for the wizard.
- `AGENTS.md` — Feature contracts and cross-feature import policies.

#### Shell & E2E Tests
- `src/app/layouts/useAppRoute.ts` & `routing.ts` — Added `/import` route (`{ kind: 'import' }`).
- `src/app/layouts/ShellRoutes.tsx` — Lazy-loaded route branch for `ImporterScreen`.
- `src/app/layouts/AppSidebar/AppSidebar.tsx` — Added "Import" nav rail button with `FileUp` icon.
- `tests/e2e/importer/importer.spec.ts` — Playwright acceptance test suite for 5-step wizard, AI cleanup diff, and workspace navigation.

### Modified
- `src/app/bootstrap/createRepositories.ts` & `createUseCases.ts` — Wired importer repositories and use cases into composition root.
- `src/infrastructure/database/repositories/__tests__/DexieAiChatRepository.test.ts` — Updated Dexie schema version assertion to v10.
- `worker/src/index.ts` — Fixed Workers AI prompt formatting: system prompt merging and automatic adjacent same-role message merging for ChatML compliance.
- `vite.config.ts` — Raised Workbox PWA precache limit to 3 MiB to accommodate code-split worker bundles.
- `AGENTS.md`, `src/features/AGENTS.md`, `src/domain/AGENTS.md`, `src/application/AGENTS.md`, `src/infrastructure/AGENTS.md`, `src/app/AGENTS.md`, `docs/roadmap.md` — DOX documentation updates.

---

## 3. Component & Layer Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Presentation Layer                            │
│  ImporterScreen (5-Step Wizard)                                        │
│  ├── ImportDropZone (File Picker & Drag-Drop)                         │
│  ├── ExtractionProgressView (Bounded Queue Status)                     │
│  ├── ImportReviewView (Lexical WriterEditor + MarkdownViewer)          │
│  │   └── AiCleanupDiffModal (Original vs Cleaned Diff)                 │
│  ├── MaterialDetailsView (Title, Subject, Term)                        │
│  └── ImportResultView (Workspace Navigation & Summary)                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                           Application Layer                            │
│  ExtractContentUseCase ───────► markdownConverter (6 Pure Passes)     │
│  CommitImportUseCase   ───────► Atomic Multi-Store Persistence         │
│  CleanupImportWithAiUseCase ──► AiService (Streaming Prompt)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                             Domain Layer                               │
│  ContentImporter / ImporterRegistry Ports                              │
│  ImportAssetRepository Port                                            │
│  Domain Entities (ImportSession, ImportCandidate, ExtractionResult)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Infrastructure Layer                           │
│  PdfjsImporter (pdfjs-dist) ──► TesseractExtractor (tesseract.js)      │
│  ImageImporter (PNG, JPG, JFIF, WEBP, HEIC)                            │
│  DexieImportAssetRepository (IndexedDB importAssets Store v10)        │
│  WorkerAiAdapter (Cloudflare Workers AI SSE Bridge)                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Core Domain & Data Resolution

- **Port & Adapter Registry Pattern:** File formats are handled through `ContentImporter` instances resolved by `ImporterRegistry.resolve(file)`.
- **Pure Markdown Transformation:** Importers output raw `ExtractionResult` (`text`, `pages`, `confidence`). Transformation into Markdown is exclusively owned by `convertToMarkdown()` in `ExtractContentUseCase`.
- **Page Anchors & Provenance:** Multi-page documents insert standard `## Page N` anchors separated by `---` rules, enabling per-page citations and future synchronization.

---

## 5. Asset & Storage Organization

- **Binary Preservation (`importAssets`):** Original uploaded files are persisted as Blobs in IndexedDB under `importAssets` with composite metadata (`materialId`, `blob`, `mimeType`, `filename`, `importedAt`).
- **Markdown Storage (`documentContents`):** Converted, user-reviewed Markdown is saved to the existing `documentContents` store (`documentId: 'imported-<materialId>'`).
- **Catalog Integration (`materials`):** Metadata records are created in `materials`, linking to subjects and academic terms.

---

## 6. Migration Strategy

- **Dexie Schema v10:** Upgraded database version to 10 in `schema.ts`:
  ```typescript
  db.version(10).stores({
    importAssets: 'materialId',
  });
  ```
- **Zero-Migration Overhead:** `importAssets` is an additive store; existing user data across library, reader, quizzes, flashcards, and AI threads remains completely untouched.

---

## 7. Error Handling & Guarding Strategy

- **Typed `ImportError` Codes:** Handled deterministically with recovery hints:
  - `unsupported-file` — format not handled by registry.
  - `pdf-password-protected` — triggers password unlock modal (`retryable: true`).
  - `pdf-corrupted` — malformed PDF file.
  - `ocr-failed` — image processing failure.
  - `cancelled` — user aborted extraction via `AbortController`.
- **ChatML Compliance:** Cloudflare Worker AI routes automatically merge consecutive same-role messages to avoid `workerd` internal runtime errors.

---

## 8. End-to-End Data Flow

```
[ User drops file: lecture.pdf ]
             │
             ▼
[ Step 1: Select ] ──► Bounded Extraction Queue (Max 2 Jobs)
             │
             ▼
[ Step 2: Extract ]
  ├── PdfjsImporter: Extracts native text per page
  └── Low-density fallback: Renders canvas ──► TesseractExtractor (OCR)
             │
             ▼
[ ExtractContentUseCase ]
  └── convertToMarkdown() ──► 6-Pass Pipeline (Normalization, Structure, Anchors, Lists, Tables, Cleanup)
             │
             ▼
[ Step 3: Review ] ──► User edits in WriterEditor / previews in MarkdownViewer
  └── (Optional) Click "✨ AI Cleanup" ──► Streaming Diff Modal ──► Accept / Reject
             │
             ▼
[ Step 4: Details ] ──► Title, Subject, Term assignment
             │
             ▼
[ Step 5: Save ] ──► CommitImportUseCase
  ├── Dexie materials store (StudyMaterial)
  ├── Dexie documentContents store (Markdown)
  └── Dexie importAssets store (Original PDF Blob)
             │
             ▼
[ Open in Workspace ] ──► Navigates to /materials/:id?tab=read
```

---

## 9. Deprecated / Removed Architecture

- **No Raw Textareas:** Avoided unstyled textarea inputs for reviewing extracted Markdown; reused Lexical `WriterEditor` directly to guarantee visual consistency with `/write`.
- **No Monolithic Memory Buffers:** Eliminated bulk PDF canvas allocation by rendering and disposing canvases sequentially page-by-page.

---

## 10. Verification & Quality Assurance

- **Build Check:** `npm run build` compiles with 0 errors in 2.16s.
- **Lint Check:** `npm run lint` passes with 0 errors via oxlint.
- **Unit & Integration Tests:** 40 Vitest test files passing (224 tests).
- **End-to-End Tests:** 14 Playwright real-browser acceptance tests passing (`npm run test:e2e`).

---

## 11. Full System Architecture Overview

```
src/
  ├── app/            # Shell layout, routing (/import), composition root bootstrap
  ├── application/    # ExtractContentUseCase, CommitImportUseCase, CleanupImportWithAiUseCase
  ├── domain/         # ContentImporter, ImporterRegistry, ImportAssetRepository, markdownConverter/
  ├── features/
  │   ├── importer/   # 5-step wizard UI, drop zone, progress view, review editor, details form
  │   ├── writer/     # Reusable Lexical WriterEditor
  │   ├── reader/     # Reusable MarkdownViewer
  │   └── catalog/    # Subject & term query keys and selectors
  ├── infrastructure/ # PdfjsImporter, TesseractExtractor, ImageImporter, DexieImportAssetRepository (v10)
  └── shared/         # Base components, tokens, styles
```

---

## 12. Final Assessment & Next Phase Readiness

- **Phase 9 Completion:** **100% Complete & Production Ready**.
- **Supported Formats:** PDF, PNG, JPG, JPEG, JFIF, WEBP, HEIC, HEIF.
- **Next Phase Readiness:** Ready to advance to **Phase 10 — Cloud Synchronization** (syncing Dexie stores `materials`, `documentContents`, `quizSessions`, `flashcardReviews`, `aiThreads`, and `importAssets` with Cloudflare D1 / R2).
