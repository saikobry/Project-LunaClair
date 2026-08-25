import type { ExtractionResult, ExtractionProgress } from './importer.types';

export interface ExtractionOptions {
  signal?: AbortSignal;
  onProgress?: (progress: ExtractionProgress) => void;
  /** Password for encrypted PDFs */
  password?: string;
  /** OCR language code (default: 'eng') */
  language?: string;
}

/** Provider-agnostic port for importing content from a specific file type */
export interface ContentImporter {
  /** Returns true if this importer can handle the given file */
  supports(file: File): boolean;
  /** Human-readable format label (e.g. "PDF Document", "Image (OCR)") */
  readonly formatLabel: string;
  /** Extract raw text content from the file. Does NOT convert to Markdown. */
  extract(file: File, options?: ExtractionOptions): Promise<ExtractionResult>;
}

/** Registry of available importers — resolved by file type at runtime */
export interface ImporterRegistry {
  /** Find the first importer that supports this file, or undefined */
  resolve(file: File): ContentImporter | undefined;
  /** All registered importers */
  readonly importers: readonly ContentImporter[];
  /** Comma-separated accepted file extensions for the file picker accept attribute */
  readonly acceptedTypes: string;
}
