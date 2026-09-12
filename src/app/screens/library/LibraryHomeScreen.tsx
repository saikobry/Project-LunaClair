import { useState, useCallback, useMemo } from 'react';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { QuizLaunchRequest } from '../../../features/quiz/types/quizFeature.types';
import { useLibrary } from '../../../features/materials/hooks/queries/useLibrary';
import { useUnassignedMaterials } from '../../../features/collections/hooks/queries/useUnassignedMaterials';
import { useCreateMaterial } from '../../../features/materials/hooks/mutations/useCreateMaterial';
import { useDeleteMaterial } from '../../../features/materials/hooks/mutations/useDeleteMaterial';
import { useEditMaterial } from '../../../features/materials/hooks/mutations/useEditMaterial';
import LibraryView from '../../../features/materials/components/LibraryView';
import LibraryModals from './LibraryModals';

export interface LibraryHomeScreenProps {
  onOpenMaterial: (materialId: string) => void;
  onStartQuiz: (request: QuizLaunchRequest) => void;
  onManage: (materialId: string) => void;
  onBrowseAvailable: () => void;
  /** Unfiled mode: shows only materials assigned to no collection. */
  unfiledOnly?: boolean;
  /** Navigates back to the full library (unfiled empty state). */
  onBrowseLibrary?: () => void;
}

export function LibraryHomeScreen({
  onOpenMaterial,
  onStartQuiz,
  onManage,
  onBrowseAvailable,
  unfiledOnly = false,
  onBrowseLibrary,
}: LibraryHomeScreenProps) {
  const { materials: libraryMaterials, isLoading: materialsLoading } = useLibrary();
  const { materials: unfiledMaterials, isLoading: unfiledLoading } = useUnassignedMaterials();
  const materials = unfiledOnly ? unfiledMaterials : libraryMaterials;
  const isLoading = unfiledOnly ? unfiledLoading : materialsLoading;

  const createMutation = useCreateMaterial();
  const deleteMutation = useDeleteMaterial();
  const editMutation = useEditMaterial();

  const [editTarget, setEditTarget] = useState<StudyMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudyMaterial | null>(null);
  const [showCreateMaterial, setShowCreateMaterial] = useState(false);
  const [managingCollectionsMaterial, setManagingCollectionsMaterial] = useState<StudyMaterial | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Extract all unique tags from materials, sorted alphabetically
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    materials.forEach((m) => {
      m.tags?.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [materials]);

  // Helper to check if material matches search query
  const matchesSearch = useCallback(
    (material: StudyMaterial, query: string) => {
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        material.title.toLowerCase().includes(q) ||
        material.description?.toLowerCase().includes(q) ||
        material.tags?.some((tag) => tag.toLowerCase().includes(q)) ||
        false
      );
    },
    [],
  );

  // Helper to check if material matches selected tags (AND logic)
  const matchesTags = useCallback(
    (material: StudyMaterial, tags: string[]) => {
      if (tags.length === 0) return true;
      const materialTags = new Set(material.tags);
      return tags.every((tag) => materialTags.has(tag));
    },
    [],
  );

  // Filter materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(
      (m) => matchesSearch(m, searchQuery) && matchesTags(m, selectedTags),
    );
  }, [materials, searchQuery, selectedTags, matchesSearch, matchesTags]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleToggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) {
        return prev.filter((t) => t !== tag);
      }
      return [...prev, tag];
    });
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTags([]);
  }, []);

  const handleNewMaterial = useCallback(() => {
    setShowCreateMaterial(true);
  }, []);

  const handleOpen = useCallback(
    (material: StudyMaterial) => {
      onOpenMaterial(material.id);
    },
    [onOpenMaterial],
  );

  const handleEditTrigger = useCallback((material: StudyMaterial) => {
    setEditTarget(material);
  }, []);

  const handleEditSave = useCallback(
    (title: string, description: string, tags?: string[]) => {
      if (!editTarget) return;
      editMutation.mutate({
        id: editTarget.id,
        input: { title, description, tags },
      });
      setEditTarget(null);
    },
    [editTarget, editMutation],
  );

  const handleEditClose = useCallback(() => {
    setEditTarget(null);
  }, []);

  const handleCreateMaterialSave = useCallback(
    (title: string, description: string, tags?: string[]) => {
      createMutation.mutate({ title, description, tags });
      setShowCreateMaterial(false);
    },
    [createMutation],
  );

  const handleCreateMaterialClose = useCallback(() => {
    setShowCreateMaterial(false);
  }, []);

  const handleDeleteTrigger = useCallback((material: StudyMaterial) => {
    setDeleteTarget(material);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deleteMutation]);

  const handleDeleteClose = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const handleStartQuiz = useCallback(
    (material: StudyMaterial) => {
      onStartQuiz({ type: 'quiz', quizId: material.id, materialId: material.id, source: 'library' });
    },
    [onStartQuiz],
  );

  const handleCloseManageCollections = useCallback(() => {
    setManagingCollectionsMaterial(null);
  }, []);

  return (
    <>
      <LibraryView
        isLoading={isLoading}
        materials={filteredMaterials}
        allTags={allTags}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedTags={selectedTags}
        onToggleTag={handleToggleTag}
        onClearFilters={handleClearFilters}
        onNewMaterial={handleNewMaterial}
        onOpen={handleOpen}
        onEdit={handleEditTrigger}
        onDelete={handleDeleteTrigger}
        onStartQuiz={handleStartQuiz}
        onManage={(m) => onManage(m.id)}
        onBrowseAvailable={onBrowseAvailable}
        unfiledMode={unfiledOnly}
        onBrowseLibrary={onBrowseLibrary}
      />
      <LibraryModals
        editTarget={editTarget}
        deleteTarget={deleteTarget}
        showCreateMaterial={showCreateMaterial}
        onEditSave={handleEditSave}
        onEditClose={handleEditClose}
        onCreateMaterialSave={handleCreateMaterialSave}
        onCreateMaterialClose={handleCreateMaterialClose}
        onDeleteConfirm={handleDeleteConfirm}
        onDeleteClose={handleDeleteClose}
        managingCollectionsMaterial={managingCollectionsMaterial}
        onCloseManageCollections={handleCloseManageCollections}
      />
    </>
  );
}

export default LibraryHomeScreen;
