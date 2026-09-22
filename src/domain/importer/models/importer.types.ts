export type ImportSource = 'pdf' | 'image';

export interface PageExtraction {
  pageNumber: number;
  text: string;
  confidence: number;
  source: 'pdf-text' | 'ocr' | 'ai-vision';
  warnings?: string[];
}

export interface ExtractionStats {
  wordCount: number;
  characterCount: number;
  headingsDetected: number;
  ocrPages: number;
  visionPages?: number;
  textPages: number;
}

export interface ExtractionResult {
  text: string;
  title?: string;
  pageCount: number;
  pages: PageExtraction[];
  stats: ExtractionStats;
  isPartial?: boolean;
}

export interface ExtractionProgress {
  phase: 'scanning' | 'loading' | 'extracting' | 'ocr' | 'ai-vision' | 'converting' | 'cooldown' | 'done';
  current: number;
  total: number;
  percent: number;
  pageLabel?: string;
}

export interface ImportMetadata {
  source: ImportSource;
  originalFilename: string;
  importedAt: string;
  pageCount: number;
  usedOcr: boolean;
  ocrConfidence?: number;
  usedVision?: boolean;
}

export type ImportErrorCode =
  | 'unsupported-file'
  | 'pdf-password-protected'
  | 'pdf-corrupted'
  | 'ocr-language-missing'
  | 'ocr-failed'
  | 'extraction-failed'
  | 'out-of-memory'
  | 'cancelled'
  | 'save-failed';

export interface ImportError {
  code: ImportErrorCode;
  message: string;
  retryable: boolean;
  recoveryHint?: string;
}

export interface ImportCandidate {
  id: string;
  filename: string;
  source: ImportSource;
  file: File;
  extraction?: ExtractionResult;
  markdown?: string;
  title?: string;
  importMetadata?: ImportMetadata;
  status: 'pending' | 'extracting' | 'review' | 'saving' | 'done' | 'error';
  error?: ImportError;
  pageDetails?: PageExtraction[];
}

export interface ImportSession {
  id: string;
  createdAt: string;
  candidates: ImportCandidate[];
  status: 'selecting' | 'extracting' | 'review' | 'details' | 'saving' | 'completed';
}
