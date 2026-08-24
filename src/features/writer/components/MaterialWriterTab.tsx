import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { FileQuestion } from 'lucide-react';
import { useMaterial } from '../../catalog/materials/hooks/queries/useMaterial';
import { useDocument } from '../../reader/hooks/useDocument';
import { useUpdateDocumentContent } from '../hooks/mutations/useUpdateDocumentContent';
import { WriterEditor } from './WriterEditor';
import { WriterActionBar } from './WriterActionBar';
import { UnsavedChangesModal } from './UnsavedChangesModal';
import { normalizeMarkdown } from '../utils/markdownNormalizer';
import { ErrorState } from '../../../shared/ui/ErrorState/ErrorState';

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

const styles = stylex.create({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
    width: '100%',
    boxSizing: 'border-box',
  },
  rawEditorArea: {
    width: '100%',
    height: 580,
    fontFamily: 'ui-monospace, Consolas, Monaco, monospace',
    fontSize: 13,
    lineHeight: 1.55,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--color-border, #e5e7eb)',
    backgroundColor: '#0f172a',
    color: '#e2e8f0',
    boxSizing: 'border-box',
    outline: 'none',
  },
  loadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '64px 24px',
    color: 'var(--color-text-secondary, #6b7280)',
    fontSize: 14,
  },
});

export interface MaterialWriterTabProps {
  materialId: string;
}

export function MaterialWriterTab({ materialId }: MaterialWriterTabProps) {
  // Internal active ID — held until an unsaved-switch is confirmed or cancelled
  const [activeMaterialId, setActiveMaterialId] = useState<string>(materialId);
  const pendingSwitchMaterialIdRef = useRef<string | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState<boolean>(false);

  const { material, isLoading: isMaterialLoading } = useMaterial(activeMaterialId);
  const { data: doc, isLoading: isDocLoading, error: docError } = useDocument(material ?? null);
  const updateContentMutation = useUpdateDocumentContent();

  // --- Draft state ---
  const savedMarkdown = useMemo(() => doc?.content ?? '', [doc?.content]);
  const [draftMarkdown, setDraftMarkdown] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
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

  // --- Intercept prop materialId changes when active editor is dirty ---
  useEffect(() => {
    if (materialId !== activeMaterialId) {
      if (isDirty) {
        pendingSwitchMaterialIdRef.current = materialId;
        setShowUnsavedModal(true);
      } else {
        setActiveMaterialId(materialId);
        setIsHydrated(false);
      }
    }
  }, [materialId, activeMaterialId, isDirty]);

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
  }, [doc, isDocLoading, activeMaterialId, isHydrated]);

  // --- External sync: update draft when server content changes ---
  useEffect(() => {
    if (
      isHydrated &&
      doc !== undefined &&
      lastSavedMarkdownRef.current !== null &&
      doc.content !== lastSavedMarkdownRef.current
    ) {
      lastSavedMarkdownRef.current = doc.content;
      if (!isDirtyRef.current) {
        setDraftMarkdown(doc.content);
        setEditorKey((k) => k + 1);
      }
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

  const handleStay = useCallback(() => {
    setShowUnsavedModal(false);
    pendingSwitchMaterialIdRef.current = null;
  }, []);

  const handleConfirmDiscardAndSwitch = useCallback(() => {
    setShowUnsavedModal(false);
    if (pendingSwitchMaterialIdRef.current) {
      setActiveMaterialId(pendingSwitchMaterialIdRef.current);
      pendingSwitchMaterialIdRef.current = null;
      setIsHydrated(false);
    }
  }, []);

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

  // --- Render: Loading ---
  if (isMaterialLoading || isDocLoading || !isHydrated) {
    return (
      <>
        <div {...stylex.props(styles.loadingState)}>Loading document editor...</div>
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onStay={handleStay}
          onDiscard={handleConfirmDiscardAndSwitch}
          materialTitle={material?.title}
        />
      </>
    );
  }

  // --- Render: Error ---
  if (!material || docError) {
    return (
      <>
        <ErrorState
          icon={<FileQuestion size={28} />}
          title="Could not load document for editing"
          description="The material or its associated document could not be found."
        />
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onStay={handleStay}
          onDiscard={handleConfirmDiscardAndSwitch}
          materialTitle={material?.title}
        />
      </>
    );
  }

  // --- Render: Editor ---
  return (
    <div {...stylex.props(styles.root)}>
      <WriterActionBar
        saveStatus={updateContentMutation.isPending ? 'saving' : updateContentMutation.isError ? 'error' : isDirty ? 'unsaved' : 'saved'}
        isRawMode={isRawMode}
        isDirty={isDirty}
        isSaving={updateContentMutation.isPending}
        copied={copied}
        onToggleMode={handleToggleMode}
        onCopy={handleCopyMarkdown}
        onDownload={handleDownload}
        onDiscard={handleDiscard}
        onSave={handleSave}
      />

      {!isRawMode ? (
        <WriterEditor
          key={`${activeMaterialId}-${editorKey}`}
          initialMarkdown={draftMarkdown}
          onChange={handleEditorChange}
        />
      ) : (
        <textarea
          {...stylex.props(styles.rawEditorArea)}
          value={draftMarkdown}
          onChange={(e) => setDraftMarkdown(e.target.value)}
          placeholder="Type or paste markdown here..."
          aria-label="Raw Markdown Content"
        />
      )}

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onStay={handleStay}
        onDiscard={handleConfirmDiscardAndSwitch}
        materialTitle={material?.title}
      />
    </div>
  );
}
