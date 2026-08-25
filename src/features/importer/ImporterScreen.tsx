import * as stylex from '@stylexjs/stylex';
import { importerStyles } from './styles/importer.stylex';
import { useImportSession } from './hooks/useImportSession';
import { ImportDropZone } from './components/ImportDropZone';
import { ImportFileCard } from './components/ImportFileCard';
import { ExtractionProgressView } from './components/ExtractionProgressView';
import { ImportReviewView } from './components/ImportReviewView';
import { MaterialDetailsView } from './components/MaterialDetailsView';
import { ImportResultView } from './components/ImportResultView';

export interface ImporterScreenProps {
  onOpenMaterial?: (materialId: string, subjectId?: string) => void;
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
          <ImportDropZone onFilesAdded={addFiles} />
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
    </div>
  );
}

export default ImporterScreen;


