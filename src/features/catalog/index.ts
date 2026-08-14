// ── Catalog feature public contract ────────────────────────────────
// Screens
export { default as LibraryScreen } from './materials/components/LibraryScreen';
export { default as AvailableMaterialsScreen } from './available/components/AvailableMaterialsScreen';
export { default as SubjectWorkspace } from './subjects/components/SubjectWorkspace';
export type { SubjectTab } from './subjects/components/SubjectWorkspace';
export { TermManagerScreen } from './terms/components/TermManagerScreen';

// Public modals
export { default as EditMaterialModal } from './materials/modals/EditMaterialModal';
export { default as DeleteConfirmationModal } from './materials/modals/DeleteConfirmationModal';

// Public components
export { MaterialCard } from './materials/components/MaterialCard/MaterialCard';
export type { MaterialCardProps } from './materials/components/MaterialCard/MaterialCard';

// Public hooks
export { useLibrary, useMaterial, useAvailableCatalog } from './hooks';
export { useCreateMaterial, useDeleteMaterial, useEditMaterial, useTouchMaterial, useImportMaterial, useRemoveImportedMaterial } from './hooks';
export { useSubject, useSubjects } from './hooks';
export { useCreateSubject, useEditSubject, useDeleteSubject, useReorderSubjects } from './hooks';
export { useTerms, useTerm, useTermUsageCounts } from './hooks';
export { useCreateTerm, useEditTerm, useDeleteTerm } from './hooks';

// Query keys
export { catalogQueryKeys } from './queries/catalogQueryKeys';

// Constants
export { UNASSIGNED_TERM_ID, UNASSIGNED_TERM } from './terms/constants/termConstants';
