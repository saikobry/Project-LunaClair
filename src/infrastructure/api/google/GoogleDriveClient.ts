import type {
  DriveFileMetadata,
  DriveChangesResponse,
  CursorRecoveryResult,
  UploadFileParams,
  Recover410Params,
  GoogleDrivePort,
} from '../../../domain/drive/models/drive.types';
import {
  DriveHttpError,
  DriveAuthError,
  DriveQuotaExceededError,
  DriveRateLimitError,
} from '../../../domain/drive/models/drive.types';

/**
 * Options for configuring GoogleDriveClient.
 */
export interface GoogleDriveClientOptions {
  baseDelayMs?: number;
  maxRetries?: number;
  fetch?: typeof fetch;
  onTokenExpired?: () => Promise<string>;
}

/**
 * Updates Authorization Bearer header on RequestInit headers without mutating.
 */
function updateAuthHeader(headers: HeadersInit | undefined, newToken: string): HeadersInit {
  if (!headers) {
    return { Authorization: `Bearer ${newToken}` };
  }
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    const nextHeaders = new Headers(headers);
    nextHeaders.set('Authorization', `Bearer ${newToken}`);
    return nextHeaders;
  }
  if (Array.isArray(headers)) {
    const nextHeaders = headers.filter(([k]) => k.toLowerCase() !== 'authorization');
    nextHeaders.push(['Authorization', `Bearer ${newToken}`]);
    return nextHeaders;
  }
  const nextHeaders: Record<string, string> = { ...(headers as Record<string, string>) };
  for (const key of Object.keys(nextHeaders)) {
    if (key.toLowerCase() === 'authorization') {
      delete nextHeaders[key];
    }
  }
  nextHeaders.Authorization = `Bearer ${newToken}`;
  return nextHeaders;
}

/**
 * Compresses an input string or Uint8Array using browser native CompressionStream('gzip').
 */
export async function gzipCompress(data: Uint8Array | string): Promise<Uint8Array> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  const compressedStream = (stream as unknown as ReadableStream<Uint8Array>).pipeThrough(
    new CompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
  );
  const response = new Response(compressedStream as unknown as BodyInit);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Decompresses gzip bytes using browser native DecompressionStream('gzip').
 */
export async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(data);
      controller.close();
    },
  });
  const decompressedStream = (stream as unknown as ReadableStream<Uint8Array>).pipeThrough(
    new DecompressionStream('gzip') as unknown as ReadableWritablePair<Uint8Array, Uint8Array>
  );
  const response = new Response(decompressedStream as unknown as BodyInit);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Production implementation of GoogleDrivePort targeting Google Drive API v3.
 *
 * Operates strictly against `spaces: 'appDataFolder'`.
 * Implements binary-safe multipart/related uploads with native Gzip,
 * incremental changes feed consumption, 4-step 410 cursor recovery,
 * quota/rate-limit discrimination, and exponential backoff retry.
 */
export class GoogleDriveClient implements GoogleDrivePort {
  private readonly baseDelayMs: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  public onTokenExpired?: () => Promise<string>;

  constructor(options: GoogleDriveClientOptions = {}) {
    this.baseDelayMs = options.baseDelayMs ?? 1000;
    this.maxRetries = options.maxRetries ?? 3;
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.onTokenExpired = options.onTokenExpired;
  }

  /**
   * Registers a token refresh callback on the client.
   */
  setOnTokenExpired(callback?: () => Promise<string>): void {
    this.onTokenExpired = callback;
  }

  /**
   * Generates a unique file ID within appDataFolder ahead of creation.
   */
  async generateFileId(accessToken: string): Promise<string> {
    const url = 'https://www.googleapis.com/drive/v3/files/generateIds?count=1&space=appDataFolder';
    const res = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = (await res.json()) as { ids?: string[] };
    const id = data?.ids?.[0];
    if (!id) {
      throw new DriveHttpError('Missing file ID in Google Drive response', 200, 'OK', data);
    }
    return id;
  }

  /**
   * Uploads a file to appDataFolder using binary-safe multipart/related upload.
   * Compresses content using native CompressionStream('gzip') by default.
   */
  async uploadFile(params: UploadFileParams): Promise<DriveFileMetadata> {
    const boundary = `-------LunaClairBoundary${crypto.randomUUID().replace(/-/g, '')}`;

    const shouldCompress = params.compress !== false;
    let gzipBytes: Uint8Array;
    if (shouldCompress) {
      gzipBytes = await gzipCompress(params.content);
    } else {
      gzipBytes =
        typeof params.content === 'string'
          ? new TextEncoder().encode(params.content)
          : params.content;
    }

    const mimeType = params.mimeType ?? 'application/gzip';
    const metadata: Record<string, unknown> = {
      name: params.name,
      mimeType,
      parents: params.parents ?? ['appDataFolder'],
    };
    if (params.fileId) {
      metadata.id = params.fileId;
    }
    if (params.appProperties) {
      metadata.appProperties = params.appProperties;
    }

    const metadataPart =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: ${mimeType}\r\n\r\n`;

    const closingPart = `\r\n--${boundary}--\r\n`;

    const bodyBlob = new Blob([metadataPart, gzipBytes as unknown as BlobPart, closingPart], {
      type: `multipart/related; boundary=${boundary}`,
    });

    const url =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,appProperties,size,createdTime,mimeType';

    const res = await this.fetchWithRetry(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: bodyBlob,
    });

    const data = (await res.json()) as Record<string, unknown>;
    return {
      id: data.id as string,
      name: data.name as string,
      appProperties: data.appProperties as Record<string, string> | undefined,
      size: data.size as string | undefined,
      createdTime: data.createdTime as string | undefined,
      mimeType: data.mimeType as string | undefined,
    };
  }

  /**
   * Downloads and decompresses a text file from Google Drive via alt=media.
   */
  async downloadFile(
    fileId: string,
    accessToken: string,
    options?: { decompress?: boolean }
  ): Promise<string> {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    const res = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (options?.decompress === false) {
      return await res.text();
    }

    const buffer = await res.arrayBuffer();
    const decompressed = await gzipDecompress(new Uint8Array(buffer));
    return new TextDecoder().decode(decompressed);
  }

  /**
   * Downloads and decompresses binary file content from Google Drive via alt=media.
   */
  async downloadBinary(
    fileId: string,
    accessToken: string,
    options?: { decompress?: boolean }
  ): Promise<Uint8Array> {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
    const res = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const buffer = await res.arrayBuffer();
    if (options?.decompress === false) {
      return new Uint8Array(buffer);
    }

    return await gzipDecompress(new Uint8Array(buffer));
  }

  /**
   * Deletes a file by ID from Google Drive.
   */
  async deleteFile(fileId: string, accessToken: string): Promise<void> {
    const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
    await this.fetchWithRetry(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  /**
   * Lists files in appDataFolder, returning metadata. Automatically pages through all results.
   */
  async listFiles(accessToken: string, query?: string): Promise<DriveFileMetadata[]> {
    const allFiles: DriveFileMetadata[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL('https://www.googleapis.com/drive/v3/files');
      url.searchParams.set('spaces', 'appDataFolder');
      url.searchParams.set(
        'fields',
        'nextPageToken,files(id,name,appProperties,size,createdTime)'
      );
      if (query) {
        url.searchParams.set('q', query);
      }
      if (pageToken) {
        url.searchParams.set('pageToken', pageToken);
      }

      const res = await this.fetchWithRetry(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = (await res.json()) as { files?: DriveFileMetadata[]; nextPageToken?: string };
      if (Array.isArray(data.files)) {
        allFiles.push(...data.files);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);

    return allFiles;
  }

  /**
   * Retrieves a new startPageToken for changes tracking in appDataFolder.
   */
  async getStartPageToken(accessToken: string): Promise<string> {
    const url = 'https://www.googleapis.com/drive/v3/changes/startPageToken?spaces=appDataFolder';
    const res = await this.fetchWithRetry(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = (await res.json()) as { startPageToken?: string };
    if (!data?.startPageToken) {
      throw new DriveHttpError('Missing startPageToken in Google Drive response', 200, 'OK', data);
    }
    return data.startPageToken;
  }

  /**
   * Consumes incremental changes starting from pageToken in appDataFolder.
   */
  async listChanges(pageToken: string, accessToken: string): Promise<DriveChangesResponse> {
    const url = new URL('https://www.googleapis.com/drive/v3/changes');
    url.searchParams.set('spaces', 'appDataFolder');
    url.searchParams.set('pageToken', pageToken);
    url.searchParams.set(
      'fields',
      'newStartPageToken,nextPageToken,changes(fileId,removed,file(id,name,appProperties,size,createdTime))'
    );

    const res = await this.fetchWithRetry(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const data = (await res.json()) as {
      changes?: DriveChangesResponse['changes'];
      nextPageToken?: string;
      newStartPageToken?: string;
    };

    return {
      changes: Array.isArray(data.changes) ? data.changes : [],
      nextPageToken: data.nextPageToken,
      newStartPageToken: data.newStartPageToken,
    };
  }

  /**
   * Executes the 4-step cursor recovery protocol when a 410 Gone / invalid page token occurs:
   * 1. Fetches fresh startPageToken first to anchor future changes
   * 2. Fetches metadata-only files.list for appDataFolder
   * 3. In-memory diff: filters files whose id is not in appliedFileIds
   *    and whose appProperties.hlc is newer than peerWatermarks[deviceId]
   * 4. Returns { newPageToken, missingFiles }
   */
  async recover410Cursor(params: Recover410Params): Promise<CursorRecoveryResult> {
    const { accessToken, appliedFileIds, peerWatermarks } = params;

    // Step 1: Fetch fresh getStartPageToken() FIRST to anchor future changes
    const newPageToken = await this.getStartPageToken(accessToken);

    // Step 2: Fetch metadata-only file listing via files.list
    const files = await this.listFiles(accessToken);

    // Step 3: In-memory diff
    const appliedSet = appliedFileIds instanceof Set ? appliedFileIds : new Set(appliedFileIds);

    const missingFiles = files.filter((file) => {
      if (appliedSet.has(file.id)) {
        return false;
      }
      const deviceId = file.appProperties?.deviceId;
      const watermark = deviceId ? peerWatermarks[deviceId] : undefined;
      if (!watermark) {
        return true;
      }
      const hlc = file.appProperties?.hlc;
      return Boolean(hlc && hlc > watermark);
    });

    // Step 4: Return { newPageToken, missingFiles }
    return {
      newPageToken,
      missingFiles,
    };
  }

  /**
   * Uploads compressed JSON to Google Drive appDataFolder with appProperties.
   */
  async uploadCompressedJson(
    name: string,
    data: unknown,
    appProperties: Record<string, string>,
    accessToken: string,
    parents?: string[]
  ): Promise<DriveFileMetadata> {
    return this.uploadFile({
      name,
      content: JSON.stringify(data),
      compress: true,
      appProperties,
      parents: parents ?? ['appDataFolder'],
      accessToken,
    });
  }

  /**
   * Downloads and decompresses JSON file from Google Drive via alt=media.
   */
  async downloadCompressedJson<T = unknown>(fileId: string, accessToken: string): Promise<T> {
    const text = await this.downloadFile(fileId, accessToken, { decompress: true });
    return JSON.parse(text) as T;
  }

  /**
   * Alias for recover410Cursor.
   */
  async recoverFromInvalidPageToken(params: Recover410Params): Promise<CursorRecoveryResult> {
    return this.recover410Cursor(params);
  }

  /**
   * Core request dispatcher with quota discrimination, 429/5xx exponential backoff,
   * and 401 auth failure handling.
   */
  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    attempt = 0,
    hasRefreshedToken = false
  ): Promise<Response> {
    let response: Response;
    try {
      response = await this.fetchFn(url, init);
    } catch (error) {
      if (attempt < this.maxRetries) {
        await this.backoff(attempt);
        return this.fetchWithRetry(url, init, attempt + 1, hasRefreshedToken);
      }
      throw new DriveHttpError(
        `Network request failed: ${error instanceof Error ? error.message : String(error)}`,
        0,
        'NetworkError',
        error
      );
    }

    if (response.ok) {
      return response;
    }

    const status = response.status;
    const statusText = response.statusText;

    // 401 Unauthorized -> attempt onTokenExpired once if configured, else throw DriveAuthError
    if (status === 401) {
      if (this.onTokenExpired && !hasRefreshedToken) {
        let newToken: string;
        try {
          newToken = await this.onTokenExpired();
        } catch (refreshError) {
          const details = await this.parseJsonSafe(response);
          throw new DriveAuthError(
            `Google Drive authentication failed during token refresh: ${refreshError instanceof Error ? refreshError.message : String(refreshError)}`,
            details ?? refreshError
          );
        }

        const newInit: RequestInit = {
          ...init,
          headers: updateAuthHeader(init.headers, newToken),
        };

        return this.fetchWithRetry(url, newInit, attempt, true);
      }

      const details = await this.parseJsonSafe(response);
      const message =
        (details as { error?: { message?: string } })?.error?.message ??
        'Google Drive authentication failed or token expired';
      throw new DriveAuthError(message, details);
    }

    // 403 Forbidden -> check for storageQuotaExceeded vs rate limits
    if (status === 403) {
      const details = await this.parseJsonSafe(response);
      const errors = (details as { error?: { errors?: Array<{ reason?: string }> } })?.error
        ?.errors;
      const isQuota =
        Array.isArray(errors) && errors.some((e) => e.reason === 'storageQuotaExceeded');
      if (isQuota) {
        const message =
          (details as { error?: { message?: string } })?.error?.message ??
          'Google Drive storage quota exceeded';
        throw new DriveQuotaExceededError(message, details);
      }

      const isRateLimit =
        Array.isArray(errors) &&
        errors.some((e) => e.reason === 'rateLimitExceeded' || e.reason === 'userRateLimitExceeded');
      if (isRateLimit) {
        if (attempt < this.maxRetries) {
          await this.backoff(attempt, response);
          return this.fetchWithRetry(url, init, attempt + 1, hasRefreshedToken);
        }
        const retryAfter = this.parseRetryAfter(response);
        const message =
          (details as { error?: { message?: string } })?.error?.message ??
          'Google Drive rate limit exceeded';
        throw new DriveRateLimitError(message, retryAfter, details);
      }

      const message =
        (details as { error?: { message?: string } })?.error?.message ??
        `Drive API error HTTP 403: ${statusText}`;
      throw new DriveHttpError(message, 403, statusText, details);
    }

    // 429 Too Many Requests -> retry with backoff or throw DriveRateLimitError
    if (status === 429) {
      if (attempt < this.maxRetries) {
        await this.backoff(attempt, response);
        return this.fetchWithRetry(url, init, attempt + 1, hasRefreshedToken);
      }
      const details = await this.parseJsonSafe(response);
      const retryAfter = this.parseRetryAfter(response);
      const message =
        (details as { error?: { message?: string } })?.error?.message ??
        'Google Drive rate limit exceeded';
      throw new DriveRateLimitError(message, retryAfter, details);
    }

    // 5xx Server Error -> retry if transient
    if (status >= 500 && status < 600) {
      if (attempt < this.maxRetries) {
        await this.backoff(attempt, response);
        return this.fetchWithRetry(url, init, attempt + 1, hasRefreshedToken);
      }
    }

    // Other HTTP error (e.g. 400, 404, 410, 5xx after retries exhausted)
    const details = await this.parseJsonSafe(response);
    const message =
      (details as { error?: { message?: string } })?.error?.message ??
      `Drive API error HTTP ${status}: ${statusText}`;
    throw new DriveHttpError(message, status, statusText, details);
  }

  private async backoff(attempt: number, response?: Response): Promise<void> {
    if (this.baseDelayMs === 0) {
      return;
    }

    let delayMs: number;
    const retryAfterSec = this.parseRetryAfter(response);
    if (retryAfterSec !== undefined) {
      delayMs = retryAfterSec * 1000;
    } else {
      const exponential = this.baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * (this.baseDelayMs * 0.5);
      delayMs = exponential + jitter;
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  private parseRetryAfter(response?: Response): number | undefined {
    if (!response) return undefined;
    const header = response.headers.get('Retry-After');
    if (!header) return undefined;
    const seconds = parseInt(header, 10);
    return Number.isNaN(seconds) ? undefined : seconds;
  }

  private async parseJsonSafe(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
}

/**
 * Singleton GoogleDriveClient instance configured with standard defaults.
 */
export const googleDriveClient = new GoogleDriveClient();
