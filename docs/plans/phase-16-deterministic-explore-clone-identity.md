# Phase 16 — Deterministic Explore Clone Identity & Multi-Device Linking

**Status:** Planned  
**Target:** Phase 16  
**Related Documents:** `docs/roadmap.md`, `ADR-018`, `src/domain/sync/utils/hlc.ts`

---

## 1. Context & Problem Statement

In LunaClair, curriculum and community study materials are published as `.lcpack` study packages and distributed through the Explore Hub (`/explore`). When a user on Device A clicks **Clone to Library**, `ClonePublishedShareUseCase` atomically unpacks the study package and persists the document markdown, questions, and quizzes into local Dexie storage.

In a multi-device setup synchronized via Bring-Your-Own-Storage (Google Drive appDataFolder sync per ADR-018):
1. User clones an Explore course on Device A at 10:00 AM.
2. User studies and modifies the material on Device A at 10:15 AM (adding annotations, notes, or editing markdown). This mutation receives an HLC timestamp reflecting 10:15 AM (`2026-10-16T10:15:00.000Z_0000_device-A`).
3. Later at 11:00 AM, the user logs in on Device B and clones the *same* course from the Explore Hub.
4. **The Vulnerability (HLC Inversion):** If Device B stamps the newly cloned records with `Date.now()` (11:00 AM), the unmodified template records on Device B will possess an HLC of 11:00 AM. Under Last-Write-Wins (LWW) causal ordering, Device B's 11:00 AM template records would overwrite Device A's 10:15 AM user edits during synchronization.

---

## 2. Mandatory Invariant: Floor HLC Contract

To prevent template clones from clobbering user progress across devices:

> **Mandatory Invariant (Floor HLC Contract):**  
> Freshly cloned Explore course templates must be stamped with a **deterministic floor HLC** derived from `sharePackage.publishedAt` (or fixed epoch `0000_share`), and **NEVER `Date.now()`**.

### Invariant Guarantees:
1. **Preservation of User Edits:** Because `sharePackage.publishedAt` represents the historical publishing time (which is strictly earlier than any subsequent user edits), any user edit made on Device A (`10:15 AM`) will strictly dominate the template clone's floor HLC on Device B (`publishedAt < 10:15 AM`).
2. **Causal Convergence:** When Device B syncs via Google Drive, Device A's newer mutations will win under per-entity LWW, seamlessly updating Device B with the user's edits.
3. **Multi-Device Idempotence:** If both Device A and Device B clone the course at different times without making edits, both devices stamp identical floor HLCs, producing zero spurious delta journals.

---

## 3. Floor HLC Derivation Specification

When importing a study package in `ClonePublishedShareUseCase`:

```typescript
export function deriveFloorHlc(publishedAt: string | undefined): string {
  const baseTime = publishedAt && !isNaN(new Date(publishedAt).getTime())
    ? new Date(publishedAt).toISOString()
    : '1970-01-01T00:00:00.000Z';
  return `${baseTime}_0000_share`;
}
```

- **Device ID Component:** Fixed identifier `0000_share` or `share` to denote immutable publisher provenance.
- **Physical Timestamp:** Package `publishedAt` ISO-8601 string, or epoch fallback `1970-01-01T00:00:00.000Z`.
- **Logical Counter:** `0000`.

---

## 4. Deterministic Identity Across Devices

In addition to the Floor HLC contract, Phase 16 will introduce deterministic entity remapping:
1. **Deterministic Document ID:** Remap document ID based on `originShareId` (e.g. `doc_share_${originShareId}` or deterministic UUID v5) so that both Device A and Device B share the exact same entity key for the cloned material.
2. **Cross-Device Annotation Attachment:** Highlights, drawings, and flashcard review states attach deterministically by document and card key across all devices belonging to the user.
