import type { StudyMaterial } from '../../domain/library';
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

export const libraryRepository = {
  getMaterials(): StudyMaterial[] {
    return getAll();
  },

  getMaterialById(id: string): StudyMaterial | undefined {
    return getAll().find((m) => m.id === id);
  },

  createMaterial(
    title: string,
    description?: string,
    sourceType: StudyMaterial['sourceType'] = 'markdown',
    sourceId?: string,
  ): StudyMaterial {
    const now = new Date().toISOString();
    const material: StudyMaterial = {
      id: generateId(),
      title,
      description,
      sourceType,
      sourceId: sourceId ?? generateId(),
      createdAt: now,
      updatedAt: now,
    };
    const materials = getAll();
    materials.push(material);
    saveAll(materials);
    return material;
  },

  updateMaterial(id: string, updates: Partial<StudyMaterial>): StudyMaterial | undefined {
    const materials = getAll();
    const index = materials.findIndex((m) => m.id === id);
    if (index === -1) return undefined;
    materials[index] = { ...materials[index], ...updates, updatedAt: new Date().toISOString() };
    saveAll(materials);
    return materials[index];
  },

  deleteMaterial(id: string): boolean {
    const materials = getAll();
    const filtered = materials.filter((m) => m.id !== id);
    if (filtered.length === materials.length) return false;
    saveAll(filtered);
    return true;
  },

  /** Seeding helper — inserts a material only if no materials exist. */
  seedIfEmpty(material: StudyMaterial): void {
    const materials = getAll();
    if (materials.length === 0) {
      saveAll([material]);
    }
  },
};
