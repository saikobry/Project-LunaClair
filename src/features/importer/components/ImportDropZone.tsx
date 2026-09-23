import { useCallback, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import { FileUp } from 'lucide-react';
import { SegmentedControl, SegmentedControlItem } from '../../../shared/ui/SegmentedControl/SegmentedControl';

interface ImportDropZoneProps {
  onFilesAdded: (files: File[]) => void;
  ocrEngine?: 'tesseract' | 'ai-vision';
  onOcrEngineChange?: (engine: 'tesseract' | 'ai-vision') => void;
}

export function ImportDropZone({
  onFilesAdded,
  ocrEngine = 'tesseract',
  onOcrEngineChange,
}: ImportDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
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
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      onFilesAdded(files);
    }
  }, [onFilesAdded]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <div
        {...stylex.props(importerStyles.dropZone)}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={handleClick}
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
        <FileUp size={48} color="var(--color-text-secondary)" />
        <div {...stylex.props(importerStyles.dropZoneText)}>Drag & drop your study materials here, or click to browse</div>
        <div {...stylex.props(importerStyles.dropZoneHint)}>Supports PDF, PNG, JPG, JPEG, JFIF, WEBP, and .lcpack / JSON study packages</div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          padding: '10px 16px',
          borderRadius: '8px',
          backgroundColor: 'var(--color-background-surface)',
          border: '1px solid var(--color-border)',
          alignSelf: 'center',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
          Extraction Engine:
        </span>
        <SegmentedControl
          value={ocrEngine}
          onChange={(val) => onOcrEngineChange?.(val as 'tesseract' | 'ai-vision')}
          label="Extraction Engine"
          size="sm"
        >
          <SegmentedControlItem value="tesseract" label="Local OCR (Tesseract)" />
          <SegmentedControlItem
            value="ai-vision"
            label={`AI Vision (MAX)${isOffline ? ' (Offline)' : ''}`}
            isDisabled={isOffline}
          />
        </SegmentedControl>
      </div>
    </div>
  );
}
