import { useCallback, useRef } from 'react';
import * as stylex from '@stylexjs/stylex';
import { importerStyles } from '../styles/importer.stylex';
import { FileUp } from 'lucide-react';

interface ImportDropZoneProps {
  onFilesAdded: (files: File[]) => void;
}

export function ImportDropZone({ onFilesAdded }: ImportDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <FileUp size={48} color='#9ca3af' />
      <div {...stylex.props(importerStyles.dropZoneText)}>Drag & drop your study materials here, or click to browse</div>
      <div {...stylex.props(importerStyles.dropZoneHint)}>Supports PDF, PNG, JPG, JPEG, JFIF, WEBP, and .lcpack / JSON study packages</div>
    </div>
  );
}
