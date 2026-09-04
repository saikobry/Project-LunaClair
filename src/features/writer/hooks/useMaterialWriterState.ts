import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMaterial } from '../../materials/hooks/queries/useMaterial';
import { useDocument } from '../../reader/hooks/useDocument';
import { useUpdateDocumentContent } from './mutations/useUpdateDocumentContent';
import { normalizeMarkdown } from '../utils/markdownNormalizer';
import type { StudyMaterial } from '../../../domain/library/models/StudyMaterial';
import type { SaveStatus } from '../components/MaterialWriterTab';

type UpdateDocumentMutation = ReturnType<typeof useUpdateDocumentContent>;

// --- Draft editing state (hydration, dirty tracking, editor actions) ---

export interface WriterDraftState {
  savedMarkdown: string;
  draftMarkdown: string;
  setDraftMarkdown: (value: string) => void;
  isDirty: boolean;
  isRawMode: boolean;
  copied: boolean;
  editorKey: number;
  handleToggleMode: () => void;
  handleEditorChange: (markdown: string) => void;
  handleSave: () => Promise<void>;
  handleDiscard: () => void;
  handleCopyMarkdown: () => Promise<void>;
  handleDownload: () => void;
}

interface WriterDraftArgs {
  doc?: { content: string };
  isDocLoading: boolean;
  activeMaterialId: string;
  isHydrated: boolean;
  setIsHydrated: (value: boolean) => void;
  material: StudyMaterial | null;
  updateContentMutation: UpdateDocumentMutation;
}

function useWriterDraftState({
  doc,
  isDocLoading,
  activeMaterialId,
  isHydrated,
  setIsHydrated,
  material,
  updateContentMutation,
}: WriterDraftArgs): WriterDraftState {
  const savedMarkdown = useMemo(() => doc?.content ?? '', [doc?.content]);
  const [draftMarkdown, setDraftMarkdown] = useState<string>('');
  const [isRawMode, setIsRawMode] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [editorKey, setEditorKey] = useState<number>(0);

  const lastHydratedMaterialIdRef = useRef<string | null>(null);
  const lastSavedMarkdownRef = useRef<string | null>(null);
  const isDirtyRef = useRef<boolean>(false);

  const isDirty = useMemo(() => {
    if (!isHydrated) return false;
    return normalizeMarkdown(draftMarkdown) !== normalizeMarkdown(savedMarkdown);
  }, [isHydrated, draftMarkdown, savedMarkdown]);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // --- Hydrate draft from server document ---
  // The WriterEditor key changes with activeMaterialId, causing a remount.
  // This effect handles the initial hydration and material switches.
  useEffect(() => {
    if (doc !== undefined && !isDocLoading) {
      if (!isHydrated || activeMaterialId !== lastHydratedMaterialIdRef.current) {
        lastHydratedMaterialIdRef.current = activeMaterialId;
        lastSavedMarkdownRef.current = doc.content;
        setDraftMarkdown(doc.content);
        setIsHydrated(true);
        setEditorKey((k) => k + 1);
      }
    }
  }, [doc, isDocLoading, activeMaterialId, isHydrated, setIsHydrated]);

  // --- External sync: update draft when server content changes ---
  useEffect(() => {
    if (
      isHydrated &&
      doc !== undefined &&
      lastSavedMarkdownRef.current !== null &&
      doc.content !== lastSavedMarkdownRef.current
    ) {
      lastSavedMarkdownRef.current = doc.content;
      setDraftMarkdown(doc.content);
      setEditorKey((k) => k + 1);
    }
  }, [doc, isHydrated]);

  // --- Browser unload protection ---
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // --- Actions ---

  const handleToggleMode = useCallback(() => {
    setIsRawMode((prev) => !prev);
    setEditorKey((k) => k + 1);
  }, []);

  const handleEditorChange = useCallback((markdown: string) => {
    setDraftMarkdown(markdown);
  }, []);

  const handleSave = useCallback(async () => {
    if (!material || !isDirty || updateContentMutation.isPending) return;
    try {
      await updateContentMutation.mutateAsync({
        materialId: material.id,
        documentId: material.documentId,
        title: material.title,
        content: draftMarkdown,
      });
    } catch {
      // Mutation onError handles toast and error state
    }
  }, [material, isDirty, updateContentMutation, draftMarkdown]);

  const handleDiscard = useCallback(() => {
    setDraftMarkdown(savedMarkdown);
    setEditorKey((prev) => prev + 1);
    updateContentMutation.reset();
  }, [savedMarkdown, updateContentMutation]);

  const handleCopyMarkdown = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draftMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  }, [draftMarkdown]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([draftMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${material?.documentId || activeMaterialId}.md`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [draftMarkdown, material, activeMaterialId]);

  // --- Keyboard shortcut: Cmd/Ctrl + S ---
  const handleSaveRef = useRef(handleSave);
  useEffect(() => {
    handleSaveRef.current = handleSave;
  }, [handleSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (isDirtyRef.current) {
          handleSaveRef.current();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    savedMarkdown,
    draftMarkdown,
    setDraftMarkdown,
    isDirty,
    isRawMode,
    copied,
    editorKey,
    handleToggleMode,
    handleEditorChange,
    handleSave,
    handleDiscard,
    handleCopyMarkdown,
    handleDownload,
  };
}

// --- Material switching with unsaved-draft interception ---

export interface MaterialWriterState {
  material: StudyMaterial | null;
  docError: unknown;
  showUnsavedModal: boolean;
  isLoading: boolean;
  hasError: boolean;
  saveStatus: SaveStatus;
  draft: WriterDraftState;
  handleStay: () => void;
  handleConfirmDiscardAndSwitch: () => void;
}

export function useMaterialWriterState(materialId: string): MaterialWriterState {
  // Internal active ID — held until an unsaved-switch is confirmed or cancelled
  const [activeMaterialId, setActiveMaterialId] = useState<string>(materialId);
  const [pendingSwitchMaterialId, setPendingSwitchMaterialId] = useState<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const { material, isLoading: isMaterialLoading } = useMaterial(activeMaterialId);
  const { data: doc, isLoading: isDocLoading, error: docError } = useDocument(material ?? null);
  const updateContentMutation = useUpdateDocumentContent();

  const draft = useWriterDraftState({
    doc,
    isDocLoading,
    activeMaterialId,
    isHydrated,
    setIsHydrated,
    material,
    updateContentMutation,
  });

  // --- Adjust active material or trigger unsaved modal during render ---
  const [prevMaterialId, setPrevMaterialId] = useState(materialId);
  if (materialId !== prevMaterialId) {
    setPrevMaterialId(materialId);
    if (!draft.isDirty) {
      setActiveMaterialId(materialId);
      setIsHydrated(false);
    } else {
      setPendingSwitchMaterialId(materialId);
      setShowUnsavedModal(true);
    }
  }

  const handleStay = useCallback(() => {
    setShowUnsavedModal(false);
    setPendingSwitchMaterialId(null);
  }, []);

  const handleConfirmDiscardAndSwitch = useCallback(() => {
    setShowUnsavedModal(false);
    if (pendingSwitchMaterialId) {
      setActiveMaterialId(pendingSwitchMaterialId);
      setPendingSwitchMaterialId(null);
      setIsHydrated(false);
    }
  }, [pendingSwitchMaterialId]);

  const isLoading = isMaterialLoading || isDocLoading || !isHydrated;
  const hasError = !material || !!docError;
  const saveStatus: SaveStatus = updateContentMutation.isPending
    ? 'saving'
    : updateContentMutation.isError
      ? 'error'
      : draft.isDirty
        ? 'unsaved'
        : 'saved';

  return {
    material,
    docError,
    showUnsavedModal,
    isLoading,
    hasError,
    saveStatus,
    draft,
    handleStay,
    handleConfirmDiscardAndSwitch,
  };
}
