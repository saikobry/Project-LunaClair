import { useCallback } from 'react';
import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../../../features/importer/styles/importer.stylex';
import { useImportSession } from '../../../features/importer/hooks/useImportSession';
import { ImportDropZone } from '../../../features/importer/components/ImportDropZone';
import { ImportFileCard } from '../../../features/importer/components/ImportFileCard';
import { ExtractionProgressView } from '../../../features/importer/components/ExtractionProgressView';
import { ImportReviewView } from '../../../features/importer/components/ImportReviewView';
import { MaterialDetailsView } from '../../../features/importer/components/MaterialDetailsView';
import { ImportResultView } from '../../../features/importer/components/ImportResultView';
import { useImportStudyPackage } from '../../../features/package/hooks/useImportStudyPackage';
import { StudyPackagePreviewModal } from '../../../features/package/components/StudyPackagePreviewModal';

export interface ImporterScreenProps {
  onOpenMaterial?: (materialId: string) => void;
  onCancel?: () => void;
}

export function ImporterScreen({ onOpenMaterial, onCancel }: ImporterScreenProps) {
  const {
    session,
    currentStep,
    createdMaterials,
    activeCandidateIndex,
    addFiles,
    removeFile,
    startExtraction,
    updateCandidateMarkdown,
    updateCandidateTitle,
    commitSession,
    resetSession,
    goToStep,
  } = useImportSession();

  const {
    stagedPackage,
    isPreviewOpen,
    isImporting,
    stagePackageFromFile,
    closePreview,
    confirmImport,
  } = useImportStudyPackage();

  const handleFilesAdded = useCallback(
    async (files: File[]) => {
      const packageFiles: File[] = [];
      const extractionFiles: File[] = [];

      for (const file of files) {
        if (
          file.name.endsWith('.lcpack') ||
          file.name.endsWith('.json') ||
          file.type === 'application/json'
        ) {
          packageFiles.push(file);
        } else {
          extractionFiles.push(file);
        }
      }

      if (packageFiles.length > 0) {
        await stagePackageFromFile(packageFiles[0]);
      }

      if (extractionFiles.length > 0) {
        addFiles(extractionFiles);
      }
    },
    [addFiles, stagePackageFromFile],
  );

  return (
    <div {...stylex.props(importerStyles.container)}>
      <div {...stylex.props(importerStyles.header)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0 }}>Import Content</h2>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>
              {currentStep === 'selecting' && 'Step 1 of 5: Select Files'}
              {currentStep === 'extracting' && 'Step 2 of 5: Extracting Text'}
              {currentStep === 'review' && 'Step 3 of 5: Review Content'}
              {currentStep === 'details' && 'Step 4 of 5: Material Details'}
              {currentStep === 'completed' && 'Step 5 of 5: Completed'}
            </div>
          </div>
          {onCancel && currentStep !== 'completed' && (
            <button {...stylex.props(importerStyles.button, importerStyles.buttonGhost)} onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
      
      {currentStep === 'selecting' && (
        <div {...stylex.props(importerStyles.content)}>
          <ImportDropZone onFilesAdded={handleFilesAdded} />
          {session.candidates.length > 0 && (
            <div style={{ marginTop: '24px' }}>
              <div {...stylex.props(importerStyles.fileList)}>
                {session.candidates.map(c => (
                  <ImportFileCard key={c.id} candidate={c} onRemove={removeFile} />
                ))}
              </div>
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button {...stylex.props(importerStyles.button, importerStyles.buttonPrimary)} onClick={startExtraction}>
                  Start Extraction
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {currentStep === 'extracting' && (
        <ExtractionProgressView candidates={session.candidates} />
      )}
      
      {currentStep === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ImportReviewView
              candidates={session.candidates}
              activeIndex={activeCandidateIndex}
              onUpdateMarkdown={updateCandidateMarkdown}
            />
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
            <button {...stylex.props(importerStyles.button, importerStyles.buttonSecondary)} onClick={() => goToStep('selecting')}>
              Back: Files
            </button>
            <button {...stylex.props(importerStyles.button, importerStyles.buttonPrimary)} onClick={() => goToStep('details')}>
              Next: Material Details
            </button>
          </div>
        </div>
      )}
      
      {currentStep === 'details' && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ flex: 1 }}>
            <MaterialDetailsView
              candidates={session.candidates}
              onUpdateTitle={updateCandidateTitle}
              onCommit={commitSession}
            />
          </div>
          <div style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-start', backgroundColor: '#ffffff' }}>
            <button {...stylex.props(importerStyles.button, importerStyles.buttonSecondary)} onClick={() => goToStep('review')}>
              Back: Review
            </button>
          </div>
        </div>
      )}
      
      {currentStep === 'completed' && (
        <ImportResultView
          createdMaterials={createdMaterials}
          onImportAnother={resetSession}
          onOpenMaterial={onOpenMaterial}
        />
      )}

      {/* Staged StudyPackage Preview & Destination Modal */}
      <StudyPackagePreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        packageData={stagedPackage}
        onConfirmImport={confirmImport}
        isImporting={isImporting}
      />
    </div>
  );
}

export default ImporterScreen;
