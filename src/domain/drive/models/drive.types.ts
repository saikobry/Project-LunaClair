/**
 * Domain contracts and models for Google Drive appDataFolder storage.
 *
 * Implements BYOS storage contracts and error models per ADR-018.
 * Pure TypeScript models with zero React or UI dependencies.
 */

/**
 * Metadata representation of a file in Google Drive appDataFolder.
 */
export interface DriveFileMetadata {
  id: string;
  name: string;
  appProperties?: Record<string, string>;
  size?: string;
  createdTime?: string;
  mimeType?: string;
  trashed?: boolean;
}

/**
 * An item in the Google Drive changes feed.
 */
export interface DriveChangeItem {
  fileId: string;
  removed?: boolean;
  file?: DriveFileMetadata;
  time?: string;
}

/**
 * Response returned from Google Drive changes.list endpoint.
 */
export interface DriveChangesResponse {
  changes: DriveChangeItem[];
  nextPageToken?: string;
  newStartPageToken?: string;
}

/**
 * Parameters for uploading a file to Google Drive appDataFolder.
 */
export interface UploadFileParams {
  name: string;
  content: string | Uint8Array;
  mimeType?: string;
  appProperties?: Record<string, string>;
  fileId?: string;
  parents?: string[];
  compress?: boolean;
  accessToken: string;
}

/**
 * Parameters for the 4-step 410 cursor recovery protocol.
 */
export interface Recover410Params {
  accessToken: string;
  appliedFileIds: Set<string> | string[];
  peerWatermarks: Record<string, string>;
}

/**
 * Result returned by 4-step 410 cursor recovery.
 */
export interface CursorRecoveryResult {
  newPageToken: string;
  missingFiles: DriveFileMetadata[];
}

/**
 * Capability port for Google Drive appDataFolder operations.
 */
export interface GoogleDrivePort {
  /**
   * Generates a unique file ID within appDataFolder ahead of creation.
   */
  generateFileId(accessToken: string): Promise<string>;

  /**
   * Uploads a file to appDataFolder using binary-safe multipart/related upload.
   * Compresses content using native CompressionStream('gzip') by default.
   */
  uploadFile(params: UploadFileParams): Promise<DriveFileMetadata>;

  /**
   * Downloads and decompresses a text file from Google Drive via alt=media.
   */
  downloadFile(
    fileId: string,
    accessToken: string,
    options?: { decompress?: boolean }
  ): Promise<string>;

  /**
   * Downloads and decompresses binary file content from Google Drive via alt=media.
   */
  downloadBinary(
    fileId: string,
    accessToken: string,
    options?: { decompress?: boolean }
  ): Promise<Uint8Array>;

  /**
   * Deletes a file by ID from Google Drive.
   */
  deleteFile(fileId: string, accessToken: string): Promise<void>;

  /**
   * Lists files in appDataFolder, returning metadata.
   */
  listFiles(accessToken: string, query?: string): Promise<DriveFileMetadata[]>;

  /**
   * Retrieves a new startPageToken for changes tracking in appDataFolder.
   */
  getStartPageToken(accessToken: string): Promise<string>;

  /**
   * Consumes incremental changes starting from pageToken in appDataFolder.
   */
  listChanges(pageToken: string, accessToken: string): Promise<DriveChangesResponse>;

  /**
   * Executes the 4-step cursor recovery protocol when a 410 Gone / invalid page token occurs:
   * 1. Fetches fresh startPageToken first
   * 2. Fetches metadata-only files.list for appDataFolder
   * 3. In-memory diff against appliedFileIds and peerWatermarks
   * 4. Returns { newPageToken, missingFiles }
   */
  recover410Cursor(params: Recover410Params): Promise<CursorRecoveryResult>;

  /**
   * Uploads compressed JSON to Google Drive appDataFolder with appProperties.
   */
  uploadCompressedJson?(
    name: string,
    data: unknown,
    appProperties: Record<string, string>,
    accessToken: string,
    parents?: string[]
  ): Promise<DriveFileMetadata>;

  /**
   * Downloads and decompresses JSON file from Google Drive via alt=media.
   */
  downloadCompressedJson?<T = unknown>(fileId: string, accessToken: string): Promise<T>;

  /**
   * Alias for recover410Cursor.
   */
  recoverFromInvalidPageToken?(params: Recover410Params): Promise<CursorRecoveryResult>;

  /**
   * Optional callback invoked when HTTP 401 is received to refresh the access token.
   */
  onTokenExpired?: () => Promise<string>;

  /**
   * Registers a token refresh callback on the client.
   */
  setOnTokenExpired?(callback?: () => Promise<string>): void;
}

/**
 * Base error for Google Drive HTTP and network failures.
 */
export class DriveHttpError extends Error {
  readonly status: number;
  readonly statusText: string;
  readonly details?: unknown;

  constructor(message: string, status: number, statusText: string, details?: unknown) {
    super(message);
    this.name = 'DriveHttpError';
    this.status = status;
    this.statusText = statusText;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when Google Drive authentication fails or access token has expired (HTTP 401).
 */
export class DriveAuthError extends DriveHttpError {
  constructor(message = 'Google Drive authentication failed or token expired', details?: unknown) {
    super(message, 401, 'Unauthorized', details);
    this.name = 'DriveAuthError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when user storage quota in Google Drive is exceeded (HTTP 403 storageQuotaExceeded).
 */
export class DriveQuotaExceededError extends DriveHttpError {
  constructor(message = 'Google Drive storage quota exceeded', details?: unknown) {
    super(message, 403, 'Forbidden', details);
    this.name = 'DriveQuotaExceededError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when Google Drive rate limits are exhausted (HTTP 429 or rateLimitExceeded).
 */
export class DriveRateLimitError extends DriveHttpError {
  readonly retryAfterSeconds?: number;

  constructor(
    message = 'Google Drive rate limit exceeded',
    retryAfterSeconds?: number,
    details?: unknown
  ) {
    super(message, 429, 'Too Many Requests', details);
    this.name = 'DriveRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
