# src/domain/ — Business Domain Models

## Purpose

Pure business domain models and logic — interfaces, types, and pure functions that describe the problem space. Domain modules must have zero React or UI dependencies.

## Ownership

Reserved domains:
- `reader/` — Document reading, annotations, highlighting models
- `quiz/` — Quiz engine models (questions, answers, sessions)
- `library/` — Document/library catalog models, `LibraryRepository` async contract interface with DTOs (`CreateMaterialInput`, `UpdateMaterialInput`)
- `generator/` — AI content generation models

## Local Contracts

- Zero React or UI dependencies. Domain modules import only from other domains or pure TypeScript libraries.
- Importable by any feature or service layer.
- Domain logic must be testable without a browser environment.
- `LibraryRepository` is the async contract (interface) that infrastructure implementations (e.g., `LocalStorageLibraryRepository`) must satisfy.

## Work Guidance

(No specific standards yet. Filter from root AGENTS.md applies.)

## Verification

No verification framework exists yet.

## Child DOX Index

No child AGENTS.md files — each subdomain is a single `index.ts` barrel file.
