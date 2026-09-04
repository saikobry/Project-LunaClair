/**
 * Cloudflare Worker HTTP Transport implementation for Cloud Sharing (Phase 11C).
 */
import type {
  PublishedShare,
  PublishShareOptions,
  PublishShareResult,
  ShareTransport,
  ListPublicSharesParams,
  ListPublicSharesResult,
} from '../../../domain/sharing/models/sharing.types';
import type { StudyPackage } from '../../../domain/package/models/package.types';

export class ShareNetworkError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ShareNetworkError';
  }
}

export class ShareHttpError extends Error {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ShareHttpError';
    this.status = status;
    this.body = body;
  }
}

export class WorkerShareTransport implements ShareTransport {
  private readonly baseUrl: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(baseUrl: string = '/api', fetchImpl?: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  private getFetch(): typeof fetch {
    if (this.fetchImpl) {
      return this.fetchImpl;
    }
    if (typeof fetch !== 'undefined') {
      return fetch.bind(globalThis);
    }
    throw new ShareNetworkError('Global fetch is not available in the current environment');
  }

  async publish(
    pkg: StudyPackage,
    options: PublishShareOptions = {},
    signal?: AbortSignal,
  ): Promise<PublishShareResult> {
    const url = `${this.baseUrl}/shares`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (options.authToken) {
      headers.Authorization = `Bearer ${options.authToken}`;
    }
    if (options.userId) {
      headers['x-user-id'] = options.userId;
    }

    const payload = {
      package: pkg,
      accessType: options.accessType ?? 'public',
      passcode: options.passcode,
      expiresAt: options.expiresAt,
    };

    let response: Response;
    try {
      response = await this.getFetch()(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal,
      });
    } catch (err) {
      if (err instanceof ShareHttpError) {
        throw err;
      }
      throw new ShareNetworkError(
        `Failed to publish share: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = undefined;
      }
      const message =
        errorBody && typeof errorBody === 'object' && 'error' in errorBody
          ? String((errorBody as { error: string }).error)
          : `HTTP ${response.status} ${response.statusText}`;
      throw new ShareHttpError(response.status, message, errorBody);
    }

    return (await response.json()) as PublishShareResult;
  }

  async fetch(shareId: string, passcode?: string, signal?: AbortSignal): Promise<PublishedShare> {
    const url = `${this.baseUrl}/shares/${encodeURIComponent(shareId)}`;
    const headers: Record<string, string> = {};

    if (passcode) {
      headers['X-Share-Passcode'] = passcode;
    }

    let response: Response;
    try {
      response = await this.getFetch()(url, {
        method: 'GET',
        headers,
        signal,
      });
    } catch (err) {
      if (err instanceof ShareHttpError) {
        throw err;
      }
      throw new ShareNetworkError(
        `Failed to fetch share: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = undefined;
      }
      const message =
        errorBody && typeof errorBody === 'object' && 'error' in errorBody
          ? String((errorBody as { error: string }).error)
          : `HTTP ${response.status} ${response.statusText}`;
      throw new ShareHttpError(response.status, message, errorBody);
    }

    return (await response.json()) as PublishedShare;
  }

  async trackDownload(
    shareId: string,
    signal?: AbortSignal,
  ): Promise<{ success: boolean; downloadCount: number }> {
    const url = `${this.baseUrl}/shares/${encodeURIComponent(shareId)}/download`;

    let response: Response;
    try {
      response = await this.getFetch()(url, {
        method: 'POST',
        signal,
      });
    } catch (err) {
      if (err instanceof ShareHttpError) {
        throw err;
      }
      throw new ShareNetworkError(
        `Failed to track download: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = undefined;
      }
      throw new ShareHttpError(response.status, `HTTP ${response.status}`, errorBody);
    }

    return (await response.json()) as { success: boolean; downloadCount: number };
  }

  async delete(shareId: string, authToken?: string, signal?: AbortSignal): Promise<void> {
    const url = `${this.baseUrl}/shares/${encodeURIComponent(shareId)}`;
    const headers: Record<string, string> = {};

    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    let response: Response;
    try {
      response = await this.getFetch()(url, {
        method: 'DELETE',
        headers,
        signal,
      });
    } catch (err) {
      if (err instanceof ShareHttpError) {
        throw err;
      }
      throw new ShareNetworkError(
        `Failed to delete share: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!response.ok && response.status !== 204) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = undefined;
      }
      throw new ShareHttpError(response.status, `HTTP ${response.status}`, errorBody);
    }
  }

  async listPublicShares(
    params: ListPublicSharesParams = {},
    signal?: AbortSignal,
  ): Promise<ListPublicSharesResult> {
    const searchParams = new URLSearchParams();
    if (params.q) searchParams.set('q', params.q);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.cursor) searchParams.set('cursor', params.cursor);

    const queryString = searchParams.toString();
    const url = `${this.baseUrl}/shares${queryString ? `?${queryString}` : ''}`;

    let response: Response;
    try {
      response = await this.getFetch()(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
      });
    } catch (err) {
      if (err instanceof ShareHttpError) {
        throw err;
      }
      throw new ShareNetworkError(
        `Failed to list public shares: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err },
      );
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = undefined;
      }
      const message =
        errorBody && typeof errorBody === 'object' && 'error' in errorBody
          ? String((errorBody as { error: string }).error)
          : `HTTP ${response.status} ${response.statusText}`;
      throw new ShareHttpError(response.status, message, errorBody);
    }

    return (await response.json()) as ListPublicSharesResult;
  }
}

export const workerShareTransport = new WorkerShareTransport();
