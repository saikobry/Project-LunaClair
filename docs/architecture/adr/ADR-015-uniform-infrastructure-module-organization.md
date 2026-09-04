# ADR-015 — Uniform Infrastructure Module Organization

## Status
Accepted

## Introduced
Phase 12 — Architecture & Domain Standardization

## Decision Drivers
- Disparate structural conventions and ad-hoc organization across infrastructure directories.
- Need for explicit separation between database engines/schemas, repository adapters, orchestration services, network transports, browser capabilities, and import engines.
- Alignment with the 1:1 primary unit test discoverability invariant established in ADR-012.
- Strict direct-path imports with zero barrels across all infrastructure modules in accordance with ADR-010.

## Context
LunaClair's domain layer was standardized by ADR-013 around predictable responsibility-based organization (`models/`, `repositories/`, `services/`, `engines/`). The infrastructure layer benefits from the same structural discipline, but it cannot be organized identically to the domain layer.

Domain logic is pure business logic with zero external dependencies. Infrastructure, by contrast, exists specifically at the boundary between application contracts and external mechanisms: IndexedDB/Dexie, Cloudflare Worker REST APIs, Worker AI SSE streams, browser DOM/storage APIs, and third-party extraction libraries (PDF.js, Tesseract.js).

Previously, infrastructure exhibited structural anomalies:
- `database/` had schema definitions, lifecycle classes, and migration scripts at its root alongside repository and service subdirectories.
- Sync repositories (`DexieSyncQueueRepository`, `DexieSyncStateRepository`, `DexieConflictDraftRepository`) were placed in `database/sync/` rather than `database/repositories/`.
- Network transports (`WorkerSyncTransport`, `WorkerShareTransport`) and browser storage utilities (`LocalStorageCredentialsProvider`, `deviceId.ts`) were scattered across fragmented folders (`sync/`, `sharing/`).
- `api/` mixed repository implementations with content preprocessors and multi-tier composite repositories (`HybridDocumentRepository`).
- `importer/` mixed registry factories, format adapters, and extraction engines in a flat folder.
- Test suites in `database/sync/` and `importer/` grouped tests for multiple independent units into consolidated test files, violating ADR-012.

## Decision

1. **Boundary-First, Responsibility-Second Organization**: Modules in `src/infrastructure/` must be grouped primarily by their external boundary or persistence engine, and secondarily by responsibility:
   $$\text{src/infrastructure/<boundary>/<responsibility>/<Implementation>.ts}$$

2. **Authorized Boundaries and Responsibilities**:
   - **`database/`** (IndexedDB / Dexie persistence engine):
     - `schema/`: Database engine subclass (`LunaClairDatabase.ts`), versioned schema definitions (`schema.ts`), initialization (`DatabaseInitializer.ts`), and legacy migrations (`DatabaseMigrator.ts`).
     - `repositories/`: Concrete Dexie persistence adapters implementing domain repository ports (`Dexie<Aggregate>Repository.ts`). All Dexie repositories, including sync repositories, reside here.
     - `services/`: Concrete multi-table atomic transactional application services (`Dexie<Capability>Service.ts`).
     - `sync/`: IndexedDB-level sync reconciliation logic (`DexieSyncReconciler.ts`) and transactional outbox coordination (`transactionalOutbox.ts`).
   - **`api/`** (Cloudflare Worker REST API boundary):
     - `repositories/`: Remote API repository implementations satisfying domain query/fetch ports (`Api<Aggregate>Repository.ts`).
     - `transports/`: Cloudflare Worker network HTTP transports (`WorkerSyncTransport.ts`, `WorkerShareTransport.ts`).
     - `transformers/`: API-specific content preparation and URL formatting (`markdownPreprocessor.ts`).
   - **`browser/`** (Browser environment & runtime capabilities):
     - `lifecycle/`: Browser event integration binding online/offline and visibility events (`BrowserSyncLifecycle.ts`).
     - `storage/`: Browser `localStorage` credentials and device identification providers (`LocalStorageCredentialsProvider.ts`, `deviceId.ts`).
   - **`importer/`** (Document parsing and extraction boundary):
     - `registry/`: Importer registry contracts and factories (`DefaultImporterRegistry.ts`, `createExtractors.ts`).
     - `adapters/`: Concrete format adapters implementing `ContentImporter` (`PdfjsImporter.ts`, `ImageImporter.ts`).
     - `engines/`: Low-level extraction workers and OCR engines (`TesseractExtractor.ts`).
   - **`ai/`** (Worker AI gateway):
     - `adapters/`: External model streaming gateway implementations satisfying `AiService` (`WorkerAiAdapter.ts`).
     - `parsing/`: SSE stream parsing and structured JSON extraction (`parseStructuredAiResponse.ts`).
   - **`storage/`** (Composite multi-tier storage abstraction):
     - `repositories/`: Composite repositories coordinating local Dexie stores with remote API fallbacks (`HybridDocumentRepository.ts`).

3. **Predictable File and Class Naming**:
   - Repositories: `Dexie<Aggregate>Repository.ts` or `Api<Aggregate>Repository.ts` with camelCase singleton instance exports (`dexie<Aggregate>Repository`, `api<Aggregate>Repository`).
   - Services: `Dexie<Capability>Service.ts` with constructor-based dependency injection.
   - Transports: `Worker<Function>Transport.ts` with singleton exports.
   - Importers: `<Format>Importer.ts` implementing `ContentImporter`.
   - Engines: `<Technology>Extractor.ts` for raw processing engines.

4. **1:1 Primary Unit Test Colocation (ADR-012)**:
   - Every production file has a corresponding test file located in a colocated `__tests__/` directory within its responsibility folder:
     $$\text{<UnitName>.ts} \quad \longleftrightarrow \quad \text{\_\_tests\_\_/<UnitName>.test.ts}$$
   - Consolidated test files are prohibited.

5. **Zero Infrastructure Barrels (ADR-010)**:
   - Internal `index.ts` barrel files are strictly prohibited in `src/infrastructure/`. All consumers (such as `createInfrastructure.ts` and test suites) must import directly from concrete module paths.

## Alternatives Considered
- **Pure Hexagonal Organization (`adapters/`, `ports/`)**: Grouping all adapters into a single `adapters/` folder was rejected because it creates ambiguity between database, network, browser, and AI adapters.
- **Retaining Fragmented Top-Level Folders (`sync/`, `sharing/`)**: Rejected because `WorkerSyncTransport` and `WorkerShareTransport` both communicate with the Cloudflare Worker API and belong under `api/transports/`, while credential storage belongs under `browser/storage/`.
- **Placing `HybridDocumentRepository` in `api/repositories/`**: Rejected because `HybridDocumentRepository` is a multi-tier composite repository orchestrating both local Dexie and remote API persistence; placing it under `storage/repositories/` cleanly acknowledges its composite nature.

## Consequences
### Positive
- Highly predictable, boundary-oriented directory layout.
- Clean isolation of database schema, initialization, and migrations from repositories and services.
- Unification of all Cloudflare Worker HTTP network transports under `api/transports/`.
- Complete adherence to ADR-012 1:1 test discoverability with no multi-unit test files.
- Zero barrel overhead with 100% direct-path imports.

### Negative / Trade-offs
- Requires updating import paths in the composition root (`createInfrastructure.ts`), application bootstrap, and test suites.

## Related ADRs
- [ADR-001](ADR-001-repository-pattern.md) — Repository Pattern
- [ADR-007](ADR-007-feature-first-architecture.md) — Feature-First Architecture
- [ADR-010](ADR-010-replace-barrel-based-feature-boundaries.md) — Direct-Path Imports & Zero Barrels
- [ADR-012](ADR-012-primary-unit-test-organization-and-discoverability.md) — Primary Unit Test 1:1 Discoverability
- [ADR-013](ADR-013-uniform-domain-module-organization.md) — Uniform Domain Module Organization
