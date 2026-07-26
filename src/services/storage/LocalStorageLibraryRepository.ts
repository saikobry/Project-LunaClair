import type { StudyMaterial } from '../../domain/library';
import type { CreateMaterialInput, LibraryRepository, UpdateMaterialInput } from '../../domain/library/LibraryRepository';
import { STORAGE_KEYS, LEGACY_STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { getFromStorage, saveToStorage, removeFromStorage } from './localStorage';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Migrates data from the legacy storage key to the new namespaced key.
 * Runs once — if the new key already has data, migration is skipped.
 */
// TODO(v1.0): Remove legacy migration after stable release.
function migrateLibraryKey(): void {
  const existing = getFromStorage<StudyMaterial[] | null>(STORAGE_KEYS.library.materials, null);
  if (existing !== null) return;

  const legacy = getFromStorage<StudyMaterial[] | null>(LEGACY_STORAGE_KEYS.libraryMaterials, null);
  if (legacy !== null) {
    saveToStorage(STORAGE_KEYS.library.materials, legacy);
    removeFromStorage(LEGACY_STORAGE_KEYS.libraryMaterials);
  }
}

function getAll(): StudyMaterial[] {
  // TODO(v1.0): Remove legacy migration after stable release.
  migrateLibraryKey();
  const materials = getFromStorage<StudyMaterial[]>(STORAGE_KEYS.library.materials, []);

  // TODO(v1.0): Remove legacy migration after stable release.
  // Migrate demo material seeded with a random sourceId to the stable bundled sourceId.
  let dirty = false;
  for (const m of materials) {
    if (
      m.title.startsWith('Anatomy & Physiology') &&
      m.sourceId !== 'anatomy-physiology'
    ) {
      m.sourceId = 'anatomy-physiology';
      m.sourceType = 'bundled';
      dirty = true;
    }
  }
  if (dirty) saveToStorage(STORAGE_KEYS.library.materials, materials);

  return materials;
}

function saveAll(materials: StudyMaterial[]): void {
  saveToStorage(STORAGE_KEYS.library.materials, materials);
}

export class LocalStorageLibraryRepository implements LibraryRepository {
  async getMaterials(signal?: AbortSignal): Promise<StudyMaterial[]> {
    // Allow cancellation
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    // Simulate microtask delay to keep the API truly async
    await Promise.resolve();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return getAll();
  }

  async getMaterialById(id: string, signal?: AbortSignal): Promise<StudyMaterial | null> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await Promise.resolve();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return getAll().find((m) => m.id === id) ?? null;
  }

  async createMaterial(input: CreateMaterialInput): Promise<StudyMaterial> {
    const now = new Date().toISOString();
    const material: StudyMaterial = {
      id: generateId(),
      title: input.title,
      description: input.description,
      sourceType: input.sourceType ?? 'bundled',
      sourceId: input.sourceId ?? generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const materials = getAll();
    materials.push(material);
    saveAll(materials);
    return material;
  }

  async updateMaterial(id: string, input: UpdateMaterialInput): Promise<StudyMaterial> {
    const materials = getAll();
    const index = materials.findIndex((m) => m.id === id);
    if (index === -1) throw new Error(`Material not found: ${id}`);
    materials[index] = {
      ...materials[index],
      ...input,
      updatedAt: new Date().toISOString(),
    };
    saveAll(materials);
    return materials[index];
  }

  async deleteMaterial(id: string): Promise<void> {
    const materials = getAll();
    const filtered = materials.filter((m) => m.id !== id);
    if (filtered.length === materials.length) throw new Error(`Material not found: ${id}`);
    saveAll(filtered);
  }
}

/** Singleton instance shared across the application. */
export const localStorageLibraryRepository = new LocalStorageLibraryRepository();
