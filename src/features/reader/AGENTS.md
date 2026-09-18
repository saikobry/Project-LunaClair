# src/features/reader/ — Reader Feature

## Purpose

Core reading experience with advanced annotation capabilities: markdown rendering, text highlighting (CSS Custom Highlight API), freehand drawing (SVG canvas), floating TOC, and selection popover with highlight/delete actions.

## Ownership

| File / Module | Responsibility |
|---|---|
| `ReaderScreen.tsx` | Feature orchestrator — accepts `materialId`; resolves document via `useDocument` hook, renders loading/error/success states, wires annotation hooks. Rendered embedded inside MaterialWorkspace (no self-owned Page shell) |
| `components/ReaderView.tsx` | Presentation — StyleX layout containers for reader rail + viewer; renders MarkdownViewer + DrawingCanvas + AnnotationToolbar + SelectionPopover |
| `components/MarkdownViewer.tsx` | Renders processed markdown via `react-markdown` (remark-gfm + rehype-slug + inline `rehypeFigure` plugin); all element typography styled with co-located StyleX styles mapped through `components`. The rehype plugin merges `p > img` + caption `p > em` into semantic `<figure>/<figcaption>`. Takes an optional `assetUrls?: Map<string, string>` prop, distributed to the `img` renderer through a module-level context (so the `components` map stays stable), which resolves `lc-asset://{assetId}` references to object URLs |
| `components/DrawingCanvas.tsx` | Freehand SVG drawing canvas with pen/eraser tools |
| `components/DrawingToolOptions.tsx` | Sub-component rendering drawing sub-tools (pen/eraser switcher, color palette swatches, thickness picker, and undo action) |
| `components/SelectionPopover.tsx` | Floating popover on text selection — highlight color picker or delete existing highlight; StyleX container + GSAP springy entrance (`useGSAP` fromTo scale/autoAlpha) + `IconButton` actions (delete uses high-contrast red tint) |
| `components/AnnotationToolbar.tsx` | Tool mode switcher (select/draw) + actions (undo drawing, clear all). Glassmorphic StyleX dock; tool toggles and actions use `IconButton` primitives (`primary` = active tool, `ghost` = default, `danger` = clear/reset). `useGSAP` owns the desktop collapse slide and the collapsible entrance (CSS transitions scoped to non-transform props). Mode icons: `PenTool` (Draw on Page) vs `Pencil` + current-color dot (pen sub-tool). On desktop it is draggable directly by its container via `useDraggableToolbar` using pointer capture (`setPointerCapture`), sidebar boundary clamping, and `localStorage` position persistence (`STORAGE_KEYS.reader.toolbarPosition`). On mobile it renders as a fixed bottom dock at `bottom: calc(84px + safe-area)` (drops to `calc(16px + safe-area)` in Focus Mode via `useFocusMode` context / `isFocusMode` prop), and a `useMobileDockCollision` hook elevates it to `calc(140px + safe-area)` when the expanded dock would overlap the bottom-left nav/FAB zone |
| `components/Toc.tsx` | Responsive table of contents (mobile sticky top dropdown + desktop LunaClair Outline adapter sidebar) extracted from markdown headings |
| `queries/readerQueryKeys.ts` | Query key factory: `root`, `document(id)`, `assets(materialId)`, `highlights(docId)`, `drawings(docId)` |
| `hooks/useDocumentRepository.ts` | DI consumer hook returning `DocumentRepository` from context |
| `hooks/useAnnotationRepository.ts` | DI consumer hook returning `AnnotationRepository` from context |
| `hooks/useAssetRepository.ts` | DI consumer hook returning the `AssetRepository` read port from context (read-only — the reader never writes assets) |
| `hooks/useMaterialAssets.ts` | Resolves a material's stored binary assets (`AssetRepository.getByMaterialId`) into a `Map<assetId, objectURL>` for `MarkdownViewer`. Object URLs are created in an effect and revoked when the map is replaced or the hook unmounts |
| `hooks/useDocument.ts` | TanStack Query hook resolving `Document` from `StudyMaterial` via `DocumentRepository` |
| `hooks/useHighlights.ts` | TanStack Query–backed highlight state + CSS Custom Highlight API registration |
| `hooks/useDrawings.ts` | TanStack Query–backed drawing paths + body scroll-lock when drawing |
| `hooks/useDraggableToolbar.ts` | Custom hook for toolbar pointer capture, desktop sidebar boundary clamping, magnetic edge snapping, and persistent positioning |
| `hooks/useTextSelection.ts` | Listens to `selectionchange`, computes popover position, detects highlight clicks |
| `constants/annotationDefaults.ts` | `BRUSH_COLORS`, `THICKNESS_OPTIONS`, `HIGHLIGHT_COLORS` annotation tool presets |
| `utils/selection.ts` | `getOffsetsOfRange()`, `restoreRange()` — DOM Range ↔ character offset utilities |
| `hooks/mutations/useSaveHighlights.ts` | Mutation: persist full highlights array (optimistic) |
| `hooks/mutations/useDeleteHighlight.ts` | Mutation: remove single highlight by ID (optimistic) |
| `hooks/mutations/useClearHighlights.ts` | Mutation: clear all highlights (optimistic) |
| `hooks/mutations/useSaveDrawings.ts` | Mutation: persist full drawing paths array (optimistic) |
| `hooks/mutations/useClearDrawings.ts` | Mutation: clear all drawings (optimistic) |
| `types/reader.types.ts` | Reader-specific types (`PopoverState`) |

## Local Contracts

- Markdown content is resolved through `DocumentRepository` (`HybridDocumentRepository` in the composition root): document content is served directly from the local Dexie `documentContents` store (fully offline).
- **Local figure resolution contract:** document markdown carries `lc-asset://{assetId}` references for stored figures. `useMaterialAssets` reads them via `AssetRepository.getByMaterialId` and `MarkdownViewer` swaps them for object URLs at render time. Resolution order: exact `assetId` hit → labelled placeholder; any non-asset `src` (absolute URL, relative path) passes through untouched. `assetId` is identity and `materialId` is only the grouping index — never resolve a document reference by material.
- **Two URL gates must both allow the scheme**, or figures render src-less with no error (both were found by test, not assumption): `rehypeSanitize`'s `protocols.src` (default allows only http/https) and `react-markdown`'s `urlTransform` (default `defaultUrlTransform` blanks anything outside http/https/irc/mailto/xmpp). Only `lc-asset` is allowed through — resolved `blob:` URLs are minted at render time and never written back into markdown, so they are deliberately not allow-listed.
- **Object-URL lifecycle (the reason the hook uses an effect):** a URL must stay valid for every `<img>` rendered from the current map and be revoked exactly once, only when that map is no longer in use. Creating URLs during render would leak the map discarded by React StrictMode's double-invocation (`src/main.tsx` enables StrictMode). The deliberate `setState`-in-effect is a recorded oxlint exception — see `.react-doctor/false-positives.md` and the scoped `.oxlintrc.json` override.
- `ImportReviewView` deliberately does **not** receive `assetUrls`: it renders pre-commit import markdown, which carries no `lc-asset://` references (figures are rewritten to that scheme only when a package is materialized), and no material exists to read assets for yet.
- `ReaderScreen` handles `DocumentNotFoundError` with a friendly UI notice and unexpected errors separately
- Highlights persist via `AnnotationRepository` under `STORAGE_KEYS.reader.highlights` (`lunaclair.reader.highlights`)
- Drawings persist via `AnnotationRepository` under `STORAGE_KEYS.reader.drawings` (`lunaclair.reader.drawings`)
- All annotation methods require an explicit `documentId` parameter
- Drawing mode locks body scroll (`overflow: hidden`, `touchAction: none`, `overscrollBehavior: none`)
- Highlights use the CSS Custom Highlight API (`CSS.highlights.set`) — no DOM wrapper nodes
- Text selection offsets are computed via feature-local `getOffsetsOfRange` / `restoreRange` in `utils/selection.ts`
- Annotation value types (`HighlightItem`, `DrawingPath`, `Point`, `HighlightColor`, `AnnotationMode`, `DrawingTool`) live in `domain/reader/annotation.types.ts` (owned by the reader domain contract — also consumed by `infrastructure/` persistence adapters)
- Query hooks and mutation hooks are separated; mutations live in `hooks/mutations/`
- DI hooks (`useDocumentRepository`, `useAnnotationRepository`) provide repository access via context
- Reader styles are co-located StyleX definitions per component (`stylex.create` / `stylex.keyframes`); no feature-level CSS files remain
- Two StyleX-incompatible CSS rules live in `src/styles/global.css`: the CSS Custom Highlight API pseudos (`::highlight(hl-*)` — StyleX cannot target dynamic custom highlight pseudos) and the `pre code` fenced-block reset (StyleX cannot express descendant combinators). The `.markdown-viewer` class is kept on the MarkdownViewer root element as the selector hook for these global exception rules. Figure captions are NOT in global CSS — they are rendered semantically as `<figure>/<figcaption>` by the inline `rehypeFigure` plugin
- `AnnotationToolbar` renders via React Portal (`createPortal`) to `document.body`. On desktop (`> 1023px`), it floats as a draggable vertical dock with pointer capture, sidebar boundary clamping (respects 240px sidebar when open, animates to screen edge in Focus Mode), and `localStorage` position persistence (`STORAGE_KEYS.reader.toolbarPosition`). On mobile/tablet (`<= 1023px`), it renders as a fixed bottom horizontal dock elevated above bottom nav/FABs. Context flows through the portal
- Table of contents progressively collapses: `>= 1200px` renders the desktop outline as a fixed top-right overlay (`TocDesktop`) that docks as a compact miniature outline widget (`MiniToc`) with real-time active heading highlights (GSAP `useGSAP` smoothly animates expand/collapse transitions; click expands to full 240px `<Outline />`; outside click or manual collapse button minimizes back to `MiniToc`); `< 1200px` collapses into a sticky top dropdown (`TocMobile` with GSAP entrance), immediately freeing 252px of horizontal room for the article and toolbar on medium viewports before altering primary reading interaction.

## Work Guidance

- Tool modes: `select` (highlight/delete) | `draw` (freehand pen/eraser)
- Drawing tools: `pen` | `eraser`
- Highlight colors: `yellow`, `green`, `pink`, `blue`
- Brush colors: Red, Blue, Green, Orange, Purple, Black
- Thickness options: 2, 4, 8, 12
- Toolbar `IconButton` variants: active tool buttons use `primary`, standard actions `ghost`, clear/reset actions `danger` (maps to Astryx `destructive`)
- Motion: GSAP (`useGSAP`) owns toolbar expand/collapse and the selection popover entrance — do not add CSS keyframes or transform/opacity CSS transitions back to these components
- Collapse toggle icons are orientation-aware (`ChevronUp` desktop open, `ChevronDown` dock open, `Palette` when closed) — never rotate them with CSS
- Mobile dock layout: the collapsible wraps into multiple centered rows (`flexWrap: wrap`) so the expanded draw-mode dock fits on narrow screens without clipping Undo/Clear; `maxWidth: calc(100vw - 32px)` + `overflowX: auto` remain as a safety net
- Mobile dock elevation (`useMobileDockCollision`): applied only when expanded on `<= 768px`, in Focus Mode (the only state where the dock drops to `bottom: 16px` and can reach the FAB zone — gated by `isFocusMode` so `env(safe-area-inset-bottom)` cannot destabilize the measurement), and the dock's `getBoundingClientRect().left` is within `MOBILE_LEFT_COLLISION_BOUNDARY` (56px) of the left FAB zone. Elevates to `bottom: calc(72px + safe-area)` — just clear of the restore FAB (top edge ≈ 60px), not halfway up the screen

## Verification

- `npm run test:run`
- `npm run build`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files — this leaf directory has all its modules in flat subdirectories.
