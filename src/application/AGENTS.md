# src/application/ — Application Layer

## Purpose

Framework-agnostic use cases coordinating domain contracts between React adapters and infrastructure.

## Ownership

- `use-cases/quiz/` owns quiz session start and atomic submission.
- `use-cases/quiz-management/` owns question and quiz authoring workflows.
- `use-cases/library/` owns material association validation and CRUD workflows.
- `use-cases/subject/` owns subject-term and cascade workflows.
- `use-cases/reader/` owns annotation persistence workflows.

## Local Contracts

- Use cases never import React, TanStack Query, Dexie, browser APIs, or UI components.
- Dependencies are domain repository/service contracts, domain models/services, and application input/output types.
- React hooks remain thin adapters for cache behavior and presentation concerns.

## Work Guidance

- Keep persistence details in repository implementations.
- Keep grading pure in `AssessmentService`; submission coordinates grading and completion.

## Verification

- `npm run build`
- `npm run lint`

## Child DOX Index

No child AGENTS.md files.
