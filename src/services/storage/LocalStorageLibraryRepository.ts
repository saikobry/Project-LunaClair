import type { StudyMaterial } from '../../domain/library';
import type { CreateMaterialInput, LibraryRepository, UpdateMaterialInput } from '../../domain/library/LibraryRepository';
import { STORAGE_KEYS } from '../../shared/constants/storageKeys';
import { getFromStorage, saveToStorage } from './localStorage';

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getAll(): StudyMaterial[] {
  return getFromStorage<StudyMaterial[]>(STORAGE_KEYS.LIBRARY_MATERIALS, []);
}

function saveAll(materials: StudyMaterial[]): void {
  saveToStorage(STORAGE_KEYS.LIBRARY_MATERIALS, materials);
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
      sourceType: 'markdown',
      sourceId: generateId(),
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
