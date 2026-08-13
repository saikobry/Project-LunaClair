# Phase 6 Chronicle — Feature Ownership and Public Contracts

## 1. Executive Summary

Status: implementation complete (100% of ADR-009 plan items implemented; manual interaction verification remains a separate follow-up).

This phase formalized ADR-009 and moved business capability code out of `src/shared/` into owning features. Subject and term queries/mutations now live under `features/subject`, material queries under `features/library`, and quiz explorer UI under `features/quiz`. Feature root barrels expose curated public contracts, while internal paths remain private. Subject and library query-key namespaces are now separated.

The implementation also moved unused term constants into the subject feature, split a shared ActionMenu style export for Fast Refresh hygiene, and updated the living architecture and DOX contracts.

## 2. Files Changed Breakdown

### Added

- `docs/architecture/adr/ADR-009-feature-ownership-and-public-contracts.md` — accepted ADR defining ownership, domain-agnostic shared code, public contracts, internal privacy, curated APIs, and feature-owned cache keys.
- `src/features/subject/queries/subjectQueryKeys.ts` and its barrel — owns `['subject', ...]` keys for subjects and terms.
- `src/features/library/hooks/queries/index.ts` — public query-hook grouping for material data.
- `src/features/subject/hooks/index.ts`, `hooks/queries/index.ts`, and `hooks/mutations/index.ts` — feature-local public hook groupings.
- `src/shared/components/ActionMenu/menuItemStyles.ts` — separates reusable styles from the component export.
- `docs/architecture/history/phase-06-feature-ownership-and-public-contracts.md` — this handoff chronicle.

### Modified

- `AGENTS.md`, `src/features/AGENTS.md`, and `src/shared/AGENTS.md` — updated DOX contracts for public feature APIs, ownership, cache namespaces, and domain-agnostic shared code.
- `docs/architecture/architecture.md`, `docs/architecture/ui-guidelines.md`, and `docs/architecture/adr/README.md` — updated living documentation and ADR index.
- `src/features/library/index.ts`, `src/features/subject/index.ts`, and `src/features/quiz/index.ts` — curated public feature contracts.
- `src/features/library/queries/libraryQueryKeys.ts` — now owns only material keys under `['library', ...]`.
- `src/shared/hooks/index.ts`, `src/shared/components/index.ts`, and `src/shared/constants/index.ts` — purged domain-specific exports.
- App shell, workspace, reader, quiz-management, settings, library, subject, and quiz consumers — switched to public feature contracts.
- `src/infrastructure/database/LunaClairDatabase.ts` — renamed intentionally discarded migration destructuring fields to underscore-prefixed variables for a clean lint pass.

### Deleted from former locations

- Subject/term hooks removed from `src/shared/hooks/` after being relocated.
- MaterialCard, SubjectQuizExplorer, and TermGroupedSelector removed from `src/shared/components/` after being relocated.
- `src/shared/constants/termConstants.ts` removed after moving to `src/features/subject/constants/termConstants.ts`.

### Renamed / Moved

- `src/shared/hooks/useLibrary.ts` → `src/features/library/hooks/queries/useLibrary.ts`
- `src/shared/hooks/useMaterial.ts` → `src/features/library/hooks/queries/useMaterial.ts`
- `src/shared/hooks/useSubjects.ts`, `useSubject.ts`, `useTerms.ts`, `useTerm.ts`, and `useTermUsageCounts.ts` → `src/features/subject/hooks/queries/`
- `src/shared/hooks/useCreateSubject.ts`, `useEditSubject.ts`, `useDeleteSubject.ts`, `useReorderSubjects.ts`, `useCreateTerm.ts`, `useEditTerm.ts`, and `useDeleteTerm.ts` → `src/features/subject/hooks/mutations/`
- Subject term mutation and usage hooks → `src/features/subject/hooks/mutations/` and `hooks/queries/`
- `src/shared/hooks/useTermGroupedSelection.ts` → `src/features/subject/hooks/useTermGroupedSelection.ts`
- `src/shared/components/MaterialCard/` → `src/features/library/components/MaterialCard/`
- `src/shared/components/SubjectQuizExplorer/` → `src/features/quiz/components/SubjectQuizExplorer/`
- `src/shared/components/TermGroupedSelector/` → `src/features/subject/components/TermGroupedSelector/`

## 3. Component and Layer Architecture

```text
AppShell / Workspace composition
        │
        ├── subject public contract ── SubjectWorkspace, subject hooks, subjectQueryKeys
        ├── library public contract ── LibraryScreen, material hooks, material modals, libraryQueryKeys
        └── quiz public contract ──── QuizScreen, launch types, quiz renderers, tree capabilities
                │
        Feature-owned UI and TanStack Query hooks
                │
        Application use cases + domain repository contracts
                │
        DI ApplicationContext
                │
        Infrastructure/service repository adapters
                │
        Dexie IndexedDB / legacy storage migration
```

`shared/` now contains neutral UI primitives/composites, annotation value shapes used by persistence contracts, storage constants, DOM selection utilities, and infrastructure/UI hooks. Business capability code is not exported from the shared barrels.

## 4. Core Domain and Data Resolution

The domain model remains unchanged: Subjects, Terms, SubjectTerm links, StudyMaterials, Quizzes, Questions, and QuizSessions are accessed through repository contracts and application use cases. The refactor changes ownership of React-facing data resolution, not domain persistence contracts.

Material reads use `libraryQueryKeys`; subject and term reads use `subjectQueryKeys`; assessment reads use `assessmentQueryKeys`. Subject mutations invalidate subject keys and explicitly invalidate library material keys when a subject/term operation changes material associations.

## 5. Asset and Storage Organization

Static learning content remains in `public/materials/{sourceId}/`. Application code remains in `src/`; feature ownership changes do not move content assets or database storage. Keeping content outside feature bundles preserves the existing static-document loading model.

## 6. Migration Strategy

No IndexedDB schema migration is required. The change is a source-level ownership migration and a client-cache namespace correction:

- Existing persisted domain records remain compatible.
- The old mixed `['library', 'subjects' | 'terms', ...]` cache namespace is replaced by `['subject', ...]`; stale in-memory entries naturally stop matching and are refetched.
- Existing database migration behavior is unchanged.
- No new `TODO(v1.0)` cleanup marker is needed because no transitional storage path was added.

## 7. Error Handling and Guarding Strategy

The existing application guards remain intact. Feature hooks continue to use `ApplicationContext` guards and repository-backed query error states. Reader document-not-found handling and quiz/library loading states are unchanged; this phase only changes which public feature contract supplies the hook.

## 8. End-to-End Data Flow

```text
User action in feature UI
  → feature-owned query/mutation hook
  → TanStack Query key from owning feature factory
  → ApplicationContext repository or application use case
  → infrastructure adapter (Dexie / service)
  → cached result or mutation invalidation
  → owning feature view re-renders
```

For a subject term edit, for example: `TermManagerScreen` imports the subject public contract → `useEditTerm` calls the subject application/repository boundary → the mutation invalidates `subjectQueryKeys.terms()` → subject and term consumers refetch without depending on library internals.

## 9. Deprecated / Removed Architecture

- Domain query and mutation hooks in `shared/hooks/` were removed because shared code had become an accidental domain layer.
- Domain composites in `shared/components/` were removed because they knew about materials, terms, or quiz tree models.
- `libraryQueryKeys.subjects()` and library-owned subject/term key construction were removed; ownership now belongs to `subjectQueryKeys`.
- Giant quiz hook exports were reduced to stable public capabilities needed by composition consumers.
- Deep feature imports were replaced by root contract imports.

## 10. Verification and Quality Assurance

- `npm run build` — passed (`tsc -b` and `vite build`). Vite still reports the repository’s existing CSS Highlight pseudo-element and bundle-size warnings.
- `npm run lint` — passed with zero warnings and zero errors.
- `git diff --check` — passed; only Git’s normal LF/CRLF working-copy notices were reported.
- `npx react-doctor@latest --verbose --scope changed` — improved to 93/100. The remaining 19 warnings are intentional root-barrel imports required by ADR-009’s public-contract rule.
- No test framework is configured. Browser/manual CRUD and navigation verification was not run in this phase.

## 11. Full System Architecture Overview

The resulting hierarchy is:

```text
shared UI/utilities ── application workflows ── domain contracts
       ▲                         ▲                    ▲
       │                         │                    │
feature public contracts ────────┴────────────── infrastructure adapters
       │
app composition root and workspace orchestration
```

Features own business UI, feature-specific hooks, dialogs, query keys, and types. Root barrels are the compatibility boundary. `shared/` remains reusable because it no longer owns Subject, Material, Term, or Quiz capability behavior.

## 12. Final Assessment and Next-Phase Readiness

ADR-009 implementation is complete and the repository is buildable and lint-clean. The next phase can add capabilities behind feature-owned contracts without reopening the shared-layer ownership problem. Before production sign-off, run the manual navigation and CRUD checks listed in the implementation plan.
