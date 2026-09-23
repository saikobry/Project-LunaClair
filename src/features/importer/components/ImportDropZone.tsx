import { useCallback, useRef, useState } from 'react';
import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import { FileUp, Cpu, Sparkles } from 'lucide-react';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';

interface ImportDropZoneProps {
  onFilesAdded: (files: File[]) => void;
  ocrEngine?: 'tesseract' | 'ai-vision';
  onOcrEngineChange?: (engine: 'tesseract' | 'ai-vision') => void;
  showEngineConfig?: boolean;
}

export function ImportDropZone({
  onFilesAdded,
  ocrEngine = 'tesseract',
  onOcrEngineChange,
  showEngineConfig = true,
}: ImportDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = Array.from(e.dataTransfer.files).filter(f => 
      f.type.startsWith('image/') ||
      f.type === 'application/pdf' ||
      f.name.endsWith('.pdf') ||
      f.name.endsWith('.lcpack') ||
      f.name.endsWith('.json') ||
      f.type === 'application/json'
    );
    if (files.length > 0) {
      onFilesAdded(files);
    }
  }, [onFilesAdded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesAdded(files);
    }
  }, [onFilesAdded]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (e.target === fileInputRef.current) return;
    fileInputRef.current?.click();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  }, []);

  return (
    <div {...stylex.props(importerStyles.dropZoneWrapper)}>
      <div
        {...stylex.props(
          importerStyles.dropZone,
          isDraggingOver && importerStyles.dropZoneActive,
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
      >
        <input
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.jfif,.heic,.heif,.webp,.lcpack,.json,application/json"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={handleFileInputChange}
        />
        <FileUp
          size={48}
          color={isDraggingOver ? 'var(--color-accent)' : 'var(--color-text-secondary)'}
        />
        <div {...stylex.props(importerStyles.dropZoneText)}>
          {isDraggingOver
            ? 'Drop study materials here to upload'
            : 'Drag & drop your study materials here, or click to browse'}
        </div>
        <div {...stylex.props(importerStyles.dropZoneHint)}>
          Supports PDF, PNG, JPG, JPEG, JFIF, WEBP, and .lcpack / JSON study packages
        </div>
      </div>

      {showEngineConfig && (
        <div {...stylex.props(importerStyles.engineCard)}>
          <div {...stylex.props(importerStyles.engineInfo)}>
            <span {...stylex.props(importerStyles.engineLabel)}>Extraction Engine</span>
            <span {...stylex.props(importerStyles.engineHint)}>
              Choose between local on-device OCR or cloud AI vision for text transcription.
            </span>
          </div>
          <div {...stylex.props(importerStyles.engineControlWrapper)}>
            <SegmentedControl
              value={ocrEngine}
              onChange={(val) => onOcrEngineChange?.(val as 'tesseract' | 'ai-vision')}
              label="Extraction Engine"
              size="sm"
              layout="fill"
            >
              <SegmentedControlItem
                value="tesseract"
                label="Local OCR (Tesseract)"
                icon={<Cpu size={14} aria-hidden="true" />}
              />
              <SegmentedControlItem
                value="ai-vision"
                label={`AI Vision (MAX)${isOffline ? ' (Offline)' : ''}`}
                icon={<Sparkles size={14} aria-hidden="true" />}
                isDisabled={isOffline}
              />
            </SegmentedControl>
          </div>
        </div>
      )}
    </div>
  );
}
