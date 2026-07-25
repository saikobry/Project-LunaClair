import { useState, useCallback, useEffect } from 'react';
import type { StudyMaterial } from '../../../domain/library';
import { libraryRepository } from '../../../services/storage/libraryRepository';

/**
 * Manages library materials list state and CRUD actions via libraryRepository.
 */
export function useLibrary() {
  const [materials, setMaterials] = useState<StudyMaterial[]>(() =>
    libraryRepository.getMaterials(),
  );

  // Refresh materials from storage
  const refresh = useCallback(() => {
    setMaterials(libraryRepository.getMaterials());
  }, []);

  // Create a new material
  const createMaterial = useCallback(
    (title: string, description?: string) => {
      const material = libraryRepository.createMaterial(title, description);
      setMaterials((prev) => [...prev, material]);
      return material;
    },
    [],
  );

  // Update an existing material
  const updateMaterial = useCallback(
    (id: string, updates: Partial<StudyMaterial>) => {
      const updated = libraryRepository.updateMaterial(id, updates);
      if (updated) {
        setMaterials((prev) => prev.map((m) => (m.id === id ? updated : m)));
      }
      return updated;
    },
    [],
  );

  // Delete a material
  const deleteMaterial = useCallback((id: string) => {
    const success = libraryRepository.deleteMaterial(id);
    if (success) {
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    }
    return success;
  }, []);

  // Listen for storage changes from other tabs (optional)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'library-materials') {
        refresh();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [refresh]);

  return {
    materials,
    createMaterial,
    updateMaterial,
    deleteMaterial,
    refresh,
  };
}
