# src/features/writer/ — LunaClair Writer

## Purpose

LunaClair Writer is the WYSIWYG authoring and study material editing engine built on Lexical. It delivers standard Lexical capabilities and lossless Markdown transformation for real-world LunaClair study materials (headings H1–H6, paragraphs, inline formatting, multi-level nested lists, GFM tables, images, blockquotes, and horizontal rules).

## Ownership

- `components/MaterialWriterTab.tsx` — Workspace-embedded material writer tab: thin composition over `useMaterialWriterState` rendering loading/error/editor states (in-file subcomponents) and mounting `WriterActionBar` + `WriterEditor`.
- `hooks/useMaterialWriterState.ts` — Owns the `MaterialWriterTab` state machine: active-material switch interception (render-phase prev-prop guard + `UnsavedChangesModal` flow), hydration lifecycle guard, ref-based dirty tracking, save/discard/copy/export actions, `beforeunload` + Ctrl/Cmd+S listeners, and `SaveStatus` derivation.
- `components/WriterEditor.tsx` — Lexical editor core wrapper with `RichTextPlugin`, `HistoryPlugin`, `ListPlugin`, `TablePlugin`, `LinkPlugin`, `MarkdownShortcutPlugin`, and `OnChangePlugin`.
- `components/UnsavedChangesModal.tsx` — Confirmation dialog intercepting material navigation when dirty unsaved changes are present in the active editor.
- `components/WriterToolbar.tsx` — Modular formatting toolbar composing subcomponents for history, block types, inline styles, indentation, and insert actions.
- `components/toolbar/` — Granular toolbar subcomponents and StyleX styles (`WriterToolbarHistory`, `WriterToolbarBlockFormat`, `WriterToolbarInlineFormat`, `WriterToolbarIndents`, `WriterToolbarInserts`, `toolbar.stylex.ts`).
- `hooks/mutations/useUpdateDocumentContent.ts` — TanStack Query mutation hook delegating document updates to `context.useCases.content.updateDocumentContent` and invalidating reader caches.
- `nodes/standardNodes.ts` — Standard Lexical node registry (`HeadingNode`, `QuoteNode`, `ListNode`, `ListItemNode`, `TableNode`, `TableRowNode`, `TableCellNode`, `LinkNode`, `AutoLinkNode`, `CodeNode`, `CodeHighlightNode`, `HorizontalRuleNode`, `ImageNode`).
- `nodes/ImageNode.tsx` — DecoratorNode for standard markdown images (`![alt](src)`).
- `transformers/standardTransformers.ts` — Standard Markdown transformer bundle (`HR`, `TABLE`, `IMAGE`, `ENHANCED_UNORDERED_LIST`, `ENHANCED_ORDERED_LIST`, and `@lexical/markdown` transformers).
- `theme/writerTheme.ts` — Lexical theme class mappings adhering to LunaClair typography and surface tokens.
- `theme/writer.css` — Scoped CSS stylesheets for Lexical editor surfaces, tables, code blocks, and blockquotes.
- `utils/markdownNormalizer.ts` — Conservative Markdown normalization utility standardizing representation differences (table padding, bullet canonicalization, block separation) for dirty-state checks and fidelity tests.
- `tests/` — Three-layer test suite (Vitest + React Testing Library + Playwright):
  - `contracts/fidelity-contract.md` — Formal Markdown fidelity specification and classification matrix.
  - `fixtures/real-material/` — Full-length canonical curriculum markdown fixtures (*Anatomy & Physiology*, *Cellular Respiration*, *Photosynthesis*, *Genetics*, *Ancient Civilizations*, *Spanish Verbs*, *Cell Structure*).
  - `fixtures/synthetic/` — Granular synthetic markdown fixtures.
  - `harness/` — Headless editor test harness (`testEditor.ts`), semantic AST serializer (`lexicalSnapshot.ts`), and conservative normalizer (`markdownNormalizer.ts`).
  - `transformers/` — Granular unit tests for table, list, inline, and image transformers.
  - `fidelity/` — Full catalog materials, round-trip, nested structure, and fallback characterization test suites.
  - `state/` — Observable state integration tests for draft synchronization, mode switching, discard, SaveStatus state machine, and external update invariants.
  - `integration/` — Production integration tests:
    - `persistence-reader.test.ts` — Production Dexie `db.documentContents` + `DexieDocumentContentRepository` + `HybridDocumentRepository` integration test suite using scoped `fake-indexeddb`.
    - `writer-ui-state.test.tsx` — Component-level `MaterialWriterTab` lifecycle, dirty state, save failure retry, discard, and material switch modal confirmation tests.

## Local Contracts

- **Direct-path contracts only (ADR-010):** No feature-root barrel (`index.ts`). Outside consumers import directly from `src/features/writer/components/MaterialWriterTab`.
- **Architectural Boundary Guardrails:** Zero concrete persistence or infrastructure dependencies in production feature code. Pure document transformations and standard Lexical nodes.
- **Authoritative Draft State Contract:** `draftMarkdown` is the single string source of truth across Visual and Raw editing modes. Visual Lexical state synchronizes outward to `draftMarkdown` on change without continuous re-parsing; entering Visual mode re-initializes Lexical from current `draftMarkdown`.
- **Hydration Lifecycle Guard:** Editor mounting is gated behind `isHydrated` to prevent empty initial state emissions from overwriting persisting document data.
- **Local Persistence & Canonical Isolation:** Saving persists local working content to Dexie's `documentContents` store via `UpdateDocumentContentUseCase`. Local saves require zero network connectivity. Canonical remote catalog materials remain pristine.
- **Reader Cache Invalidation & Hybrid Resolution:** Successful document saves invalidate Reader query caches; `HybridDocumentRepository` resolves Dexie content first, providing immediate local overrides to the Reader.
- **Error Retention & Actionable Retry:** If persistence fails, the in-memory draft is never wiped or reset; status transitions to `'error'`, and retrying executes against the latest active draft.
- **Unsaved Draft Switch Protection:** MaterialWriterTab intercepts `materialId` prop changes while dirty and shows `UnsavedChangesModal` to prevent inadvertent draft data loss. **Scope:** This protection covers active material changes within the Writer component and browser unload via `beforeunload`. Parent-level workspace/router navigation (e.g., switching to Read/Quiz/Flashcards tabs or navigating to Library) is outside MaterialWriterTab's navigation authority — the parent may unmount the Writer before interception is possible. Routing-level unsaved-changes guards are a future workspace architecture feature (Phase 7+).
- **Semantic Fidelity & Preservation Guarantee:** Standard markdown structures (H1–H6, multi-level nested lists, GFM tables, images, links, inline styles) preserve 100% of their semantic meaning, hierarchy, and tokens across import → Lexical AST → export cycles.
- **Accessible UI:** Formatting toolbar exposes `role="toolbar"` and `aria-label="Formatting"`. Toggle buttons expose `aria-pressed` while action buttons expose descriptive `aria-label`s. Selection and focus are preserved across formatting clicks.

## Work Guidance

- Standard Lexical nodes: no custom figure/callout/definition AST nodes until standard baseline is extended.
- All styles must use StyleX or scoped CSS classes mapped in `writerTheme.ts`.
- GFM Tables: cell tokenization must use `splitTableCells()` to preserve escaped pipes `\|` and row integrity.
- Save status state machine: derive status strictly via `SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error'`.

## Verification

- `npm run test:run` — Vitest unit, transformer, fidelity, Dexie persistence, and UI state test execution (76 tests passing across 11 test suites).
- `npm run test:e2e` — Playwright real-browser acceptance test execution (10 tests passing in Chromium, validating P0 reload persistence, P0 reader formatting sync + Dexie persistence, P1 bidirectional mode switching, P1 unsaved navigation / beforeunload protection, and P2 toolbar accessibility + selection preservation).
- `npm run test:coverage` — Test coverage analysis.
- `npm run build` — TypeScript (`tsc -b`) and Vite production bundle check.
- `npm run lint` — Oxlint static boundary analysis.

## Child DOX Index

No child AGENTS.md files — this leaf feature owns its internal structure directly.
