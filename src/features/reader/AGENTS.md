# src/features/reader/ — Reader Feature

## Purpose

Core reading experience with advanced annotation capabilities: markdown rendering, text highlighting (CSS Custom Highlight API), freehand drawing (SVG canvas), floating TOC, and selection popover with highlight/delete actions.

## Ownership

| File / Module | Responsibility |
|---|---|
| `ReaderScreen.tsx` | Feature orchestrator — accepts `materialId`; resolves document via `useDocument` hook, renders loading/error/success states, wires annotation hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell) |
| `ReaderView.tsx` | Presentation — renders MarkdownViewer + DrawingCanvas + AnnotationToolbar + SelectionPopover |
| `components/MarkdownViewer.tsx` | Renders processed markdown via `react-markdown` + `rehype-highlight` |
| `components/DrawingCanvas.tsx` | Freehand SVG drawing canvas with pen/eraser tools |
| `components/SelectionPopover.tsx` | Floating popover on text selection — highlight color picker or delete existing highlight |
| `components/AnnotationToolbar.tsx` | Tool mode switcher (select/draw) + actions (undo drawing, clear all, open TOC). On mobile it renders as a fixed bottom dock that sits at `bottom: calc(84px + safe-area)` and drops to `calc(16px + safe-area)` in Focus Mode (`useFocusMode` context, optional `isFocusMode` prop override) |
| `components/Toc.tsx` | Responsive table of contents (mobile sticky top dropdown + desktop LunaClair Outline adapter sidebar) extracted from markdown headings |
| `queries/readerQueryKeys.ts` | Query key factory: `root`, `document(id)`, `highlights(docId)`, `drawings(docId)` |
| `hooks/useDocumentRepository.ts` | DI consumer hook returning `DocumentRepository` from context |
| `hooks/useAnnotationRepository.ts` | DI consumer hook returning `AnnotationRepository` from context |
| `hooks/useDocument.ts` | TanStack Query hook resolving `Document` from `StudyMaterial` via `DocumentRepository` |
| `hooks/useHighlights.ts` | TanStack Query–backed highlight state + CSS Custom Highlight API registration |
| `hooks/useDrawings.ts` | TanStack Query–backed drawing paths + body scroll-lock when drawing |
| `hooks/useTextSelection.ts` | Listens to `selectionchange`, computes popover position, detects highlight clicks |
| `constants/annotationDefaults.ts` | `BRUSH_COLORS`, `THICKNESS_OPTIONS`, `HIGHLIGHT_COLORS` annotation tool presets |
| `utils/selection.ts` | `getOffsetsOfRange()`, `restoreRange()` — DOM Range ↔ character offset utilities |
| `hooks/mutations/useSaveHighlights.ts` | Mutation: persist full highlights array (optimistic) |
| `hooks/mutations/useDeleteHighlight.ts` | Mutation: remove single highlight by ID (optimistic) |
| `hooks/mutations/useClearHighlights.ts` | Mutation: clear all highlights (optimistic) |
| `hooks/mutations/useSaveDrawings.ts` | Mutation: persist full drawing paths array (optimistic) |
| `hooks/mutations/useClearDrawings.ts` | Mutation: clear all drawings (optimistic) |
| `types/reader.types.ts` | Reader-specific types (`PopoverState`) |
| `styles/reader.css` | Reader-specific CSS with `::highlight()` pseudo-elements for multi-color highlights |

## Local Contracts

- Markdown content is fetched from `public/materials/{sourceId}/index.md` and preprocessed by `services/content/markdownPreprocessor` (not in this feature)
- `ReaderScreen` handles `DocumentNotFoundError` with a friendly UI notice and unexpected errors separately
- Highlights persist via `AnnotationRepository` under `STORAGE_KEYS.reader.highlights` (`lunaclair.reader.highlights`)
- Drawings persist via `AnnotationRepository` under `STORAGE_KEYS.reader.drawings` (`lunaclair.reader.drawings`)
- All annotation methods require an explicit `documentId` parameter
- Drawing mode locks body scroll (`overflow: hidden`, `touchAction: none`, `overscrollBehavior: none`)
- Highlights use the CSS Custom Highlight API (`CSS.highlights.set`) — no DOM wrapper nodes
- Text selection offsets are computed via feature-local `getOffsetsOfRange` / `restoreRange` in `utils/selection.ts`
- Annotation value types (`HighlightItem`, `DrawingPath`, `Point`, `HighlightColor`, `AnnotationMode`, `DrawingTool`) live in `domain/reader/annotation.types.ts` (owned by the reader domain contract — also consumed by `infrastructure/` and `services/` persistence adapters)
- Query hooks and mutation hooks are separated; mutations live in `hooks/mutations/`
- DI hooks (`useDocumentRepository`, `useAnnotationRepository`) provide repository access via context
- AnnotationToolbar renders via React Portal (`createPortal`) to `document.body` on mobile/tablet viewports (`<= 1023px`) as a bottom horizontal dock to escape parent container CSS transforms. On mobile (`<= 768px`) the dock is elevated to `calc(84px + safe-area)` above the app bottom nav; in Focus Mode (`annotation-toolbar--focus` class) it transitions down to `calc(16px + safe-area)`. Context flows through the portal

## Work Guidance

- Tool modes: `select` (highlight/delete) | `draw` (freehand pen/eraser)
- Drawing tools: `pen` | `eraser`
- Highlight colors: `yellow`, `green`, `pink`, `blue`
- Brush colors: Red, Blue, Green, Orange, Purple, Black
- Thickness options: 2, 4, 8, 12

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — this leaf directory has all its modules in flat subdirectories.
