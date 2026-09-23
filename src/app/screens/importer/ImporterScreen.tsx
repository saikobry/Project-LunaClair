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
import { Page } from '../../../shared/ui/Page/Page';
import { Button } from '../../../shared/ui/Button/Button';
import { ImporterStepper } from './components/ImporterStepper';
import { getSelectingAction, firstReviewableIndex } from './utils/selectingAction';

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
    ocrEngine,
    progressMap,
    setOcrEngine,
    addFiles,
    removeFile,
    retryCandidate,
    startExtraction,
    cancelExtraction,
    updateCandidateMarkdown,
    updateCandidateTitle,
    commitSession,
    resetSession,
    goToStep,
    setActiveCandidateIndex,
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

  // Step 1's primary action is state-derived (see `selectingAction`): going Back
  // to Files must never re-extract material the user already reviewed.
  const selectingAction = getSelectingAction(session.candidates);

  const handleSelectingAction = useCallback(() => {
    if (selectingAction.action === 'review') {
      setActiveCandidateIndex(firstReviewableIndex(session.candidates));
      goToStep('review');
      return;
    }
    void startExtraction();
  }, [
    goToStep,
    selectingAction.action,
    session.candidates,
    setActiveCandidateIndex,
    startExtraction,
  ]);

  // The commit keeps rendering the Details body (and its footer) while the
  // session status is transiently `saving`, so the wizard never blanks out
  // between Save and the Completed step.
  const isDetailsStep = currentStep === 'details' || currentStep === 'saving';

  const handlePageBack = useCallback(() => {
    if (currentStep === 'details') {
      goToStep('review');
      return;
    }
    if (currentStep === 'review') {
      goToStep('selecting');
      return;
    }
    if (currentStep === 'extracting') {
      cancelExtraction();
      return;
    }
    if (currentStep === 'selecting') {
      onCancel?.();
    }
  }, [currentStep, goToStep, cancelExtraction, onCancel]);

  const pageBackLabel =
    currentStep === 'details'
      ? 'Back to Review'
      : currentStep === 'review'
        ? 'Back to Files'
        : currentStep === 'extracting'
          ? 'Cancel Extraction'
          : 'Back';

  return (
    <Page
      title="Import Material"
      description="Upload course slides, notes, or study packages to expand your library."
      onBack={currentStep !== 'completed' && currentStep !== 'saving' ? handlePageBack : undefined}
      backLabel={pageBackLabel}
    >
      {/* Three-part column: stepper, scrolling step body, pinned action bar. */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ImporterStepper currentStep={currentStep} />

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          {currentStep === 'selecting' && (
            <div {...stylex.props(importerStyles.content)}>
              <ImportDropZone
                onFilesAdded={handleFilesAdded}
                ocrEngine={ocrEngine}
                onOcrEngineChange={setOcrEngine}
                showEngineConfig={session.candidates.some(
                  (c) => c.status === 'pending' || c.status === 'error',
                )}
              />
              {session.candidates.length > 0 && (
                <div {...stylex.props(importerStyles.fileList)}>
                  {session.candidates.map((c, index) => (
                    <ImportFileCard
                      key={c.id}
                      candidate={c}
                      onRemove={removeFile}
                      onRetry={retryCandidate}
                      onReview={() => {
                        setActiveCandidateIndex(index);
                        goToStep('review');
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {currentStep === 'extracting' && (
            <ExtractionProgressView
              candidates={session.candidates}
              progressMap={progressMap}
              onCancel={cancelExtraction}
            />
          )}

          {currentStep === 'review' && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <ImportReviewView
                candidates={session.candidates}
                activeIndex={activeCandidateIndex}
                onSelectCandidate={setActiveCandidateIndex}
                onUpdateMarkdown={updateCandidateMarkdown}
              />
            </div>
          )}

          {isDetailsStep && (
            <MaterialDetailsView
              candidates={session.candidates}
              onUpdateTitle={updateCandidateTitle}
            />
          )}

          {currentStep === 'completed' && (
            <ImportResultView
              createdMaterials={createdMaterials}
              onImportAnother={resetSession}
              onOpenMaterial={onOpenMaterial}
            />
          )}
        </div>

        {currentStep === 'selecting' && session.candidates.length > 0 && (
          <div {...stylex.props(importerStyles.actionBar, importerStyles.actionBarEnd)}>
            <Button
              variant="primary"
              label={selectingAction.label}
              isDisabled={selectingAction.disabled}
              onClick={handleSelectingAction}
            />
          </div>
        )}

        {currentStep === 'review' && (
          <div {...stylex.props(importerStyles.actionBar, importerStyles.actionBarSplit)}>
            <Button variant="secondary" label="Back: Files" onClick={() => goToStep('selecting')} />
            <Button
              variant="primary"
              label="Next: Material Details"
              onClick={() => goToStep('details')}
            />
          </div>
        )}

        {isDetailsStep && (
          <div {...stylex.props(importerStyles.actionBar, importerStyles.actionBarSplit)}>
            <Button
              variant="secondary"
              label="Back: Review"
              isDisabled={currentStep === 'saving'}
              onClick={() => goToStep('review')}
            />
            <Button
              variant="primary"
              label="Save to Library"
              isLoading={currentStep === 'saving'}
              onClick={commitSession}
            />
          </div>
        )}
      </div>

      {/* Staged StudyPackage Preview & Destination Modal */}
      <StudyPackagePreviewModal
        isOpen={isPreviewOpen}
        onClose={closePreview}
        packageData={stagedPackage}
        onConfirmImport={confirmImport}
        isImporting={isImporting}
      />
    </Page>
  );
}

export default ImporterScreen;
