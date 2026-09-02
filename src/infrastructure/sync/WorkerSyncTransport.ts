import { SyncHttpError, SyncNetworkError, SyncProtocolError } from '../../domain/sync/errors/SyncErrors';
import type { SessionCredentials } from '../../domain/sync/models/sync.types';
import type { SyncEntityType, SyncOperation } from '../../domain/sync/models/sync.types';
import type { SyncPullResponse, SyncPushRequest, SyncPushResponse, SyncTransport } from '../../domain/sync/services/SyncTransport';
import type { SyncCursor } from '../../domain/sync/models/sync.types';

const VALID_ENTITY_TYPES = new Set<SyncEntityType>([
  'document',
  'highlight',
  'drawing',
  'flashcardReview',
  'quizSession',
]);

const VALID_OPERATIONS = new Set<SyncOperation>(['UPSERT', 'DELETE', 'APPEND']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates the runtime payload shape of a sync push response from Cloudflare Worker.
 */
function validatePushResponse(data: unknown): SyncPushResponse {
  if (!isRecord(data)) {
    throw new SyncProtocolError(
      'Push response must be a valid JSON object',
      data
    );
  }

  if (typeof data.serverCursor !== 'number' || !Number.isFinite(data.serverCursor) || data.serverCursor < 0) {
    throw new SyncProtocolError(
      `Push response missing valid non-negative 'serverCursor' (received ${String(data.serverCursor)})`,
      data
    );
  }

  if (!Array.isArray(data.accepted)) {
    throw new SyncProtocolError(
      "Push response missing 'accepted' array",
      data
    );
  }

  for (let i = 0; i < data.accepted.length; i++) {
    const item = data.accepted[i];
    if (!isRecord(item)) {
      throw new SyncProtocolError(
        `Push response accepted[${i}] must be an object`,
        item
      );
    }
    if (typeof item.clientMutationId !== 'string' || item.clientMutationId.length === 0) {
      throw new SyncProtocolError(
        `Push response accepted[${i}] missing valid 'clientMutationId'`,
        item
      );
    }
    if (typeof item.entityId !== 'string' || item.entityId.length === 0) {
      throw new SyncProtocolError(
        `Push response accepted[${i}] missing valid 'entityId'`,
        item
      );
    }
    if (item.newVersion !== undefined && (typeof item.newVersion !== 'number' || !Number.isFinite(item.newVersion))) {
      throw new SyncProtocolError(
        `Push response accepted[${i}] has invalid 'newVersion'`,
        item
      );
    }
  }

  if (!Array.isArray(data.conflicts)) {
    throw new SyncProtocolError(
      "Push response missing 'conflicts' array",
      data
    );
  }

  for (let i = 0; i < data.conflicts.length; i++) {
    const item = data.conflicts[i];
    if (!isRecord(item)) {
      throw new SyncProtocolError(
        `Push response conflicts[${i}] must be an object`,
        item
      );
    }
    if (typeof item.clientMutationId !== 'string' || item.clientMutationId.length === 0) {
      throw new SyncProtocolError(
        `Push response conflicts[${i}] missing valid 'clientMutationId'`,
        item
      );
    }
    if (typeof item.entityId !== 'string' || item.entityId.length === 0) {
      throw new SyncProtocolError(
        `Push response conflicts[${i}] missing valid 'entityId'`,
        item
      );
    }
    if (typeof item.serverVersion !== 'number' || !Number.isFinite(item.serverVersion)) {
      throw new SyncProtocolError(
        `Push response conflicts[${i}] missing numeric 'serverVersion'`,
        item
      );
    }
    if (!('serverPayload' in item)) {
      throw new SyncProtocolError(
        `Push response conflicts[${i}] missing 'serverPayload'`,
        item
      );
    }
  }

  if (!Array.isArray(data.rejected)) {
    throw new SyncProtocolError(
      "Push response missing 'rejected' array",
      data
    );
  }

  for (let i = 0; i < data.rejected.length; i++) {
    const item = data.rejected[i];
    if (!isRecord(item)) {
      throw new SyncProtocolError(
        `Push response rejected[${i}] must be an object`,
        item
      );
    }
    if (typeof item.clientMutationId !== 'string' || item.clientMutationId.length === 0) {
      throw new SyncProtocolError(
        `Push response rejected[${i}] missing valid 'clientMutationId'`,
        item
      );
    }
    if (typeof item.reason !== 'string') {
      throw new SyncProtocolError(
        `Push response rejected[${i}] missing string 'reason'`,
        item
      );
    }
  }

  return data as unknown as SyncPushResponse;
}

/**
 * Validates the runtime payload shape of a sync pull response from Cloudflare Worker.
 */
function validatePullResponse(data: unknown): SyncPullResponse {
  if (!isRecord(data)) {
    throw new SyncProtocolError(
      'Pull response must be a valid JSON object',
      data
    );
  }

  if (typeof data.newCursor !== 'number' || !Number.isFinite(data.newCursor) || data.newCursor < 0) {
    throw new SyncProtocolError(
      `Pull response missing valid non-negative 'newCursor' (received ${String(data.newCursor)})`,
      data
    );
  }

  if (typeof data.hasMore !== 'boolean') {
    throw new SyncProtocolError(
      "Pull response missing boolean 'hasMore'",
      data
    );
  }

  if (!Array.isArray(data.changes)) {
    throw new SyncProtocolError(
      "Pull response missing 'changes' array",
      data
    );
  }

  for (let i = 0; i < data.changes.length; i++) {
    const item = data.changes[i];
    if (!isRecord(item)) {
      throw new SyncProtocolError(
        `Pull response changes[${i}] must be an object`,
        item
      );
    }
    if (typeof item.sequence !== 'number' || !Number.isFinite(item.sequence) || item.sequence < 0) {
      throw new SyncProtocolError(
        `Pull response changes[${i}] missing numeric 'sequence'`,
        item
      );
    }
    if (typeof item.entityType !== 'string' || !VALID_ENTITY_TYPES.has(item.entityType as SyncEntityType)) {
      throw new SyncProtocolError(
        `Pull response changes[${i}] has invalid 'entityType' (${String(item.entityType)})`,
        item
      );
    }
    if (typeof item.entityId !== 'string' || item.entityId.length === 0) {
      throw new SyncProtocolError(
        `Pull response changes[${i}] missing valid 'entityId'`,
        item
      );
    }
    if (typeof item.operation !== 'string' || !VALID_OPERATIONS.has(item.operation as SyncOperation)) {
      throw new SyncProtocolError(
        `Pull response changes[${i}] has invalid 'operation' (${String(item.operation)})`,
        item
      );
    }
    if (item.version !== undefined && (typeof item.version !== 'number' || !Number.isFinite(item.version))) {
      throw new SyncProtocolError(
        `Pull response changes[${i}] has invalid 'version'`,
        item
      );
    }
    if (typeof item.changedAt !== 'string' || item.changedAt.length === 0) {
      throw new SyncProtocolError(
        `Pull response changes[${i}] missing string 'changedAt'`,
        item
      );
    }
    if (!('data' in item)) {
      throw new SyncProtocolError(
        `Pull response changes[${i}] missing 'data'`,
        item
      );
    }
  }

  return data as unknown as SyncPullResponse;
}

/**
 * Concrete Cloudflare Worker HTTP transport adapter implementing `SyncTransport`.
 * Handles header injection, network error mapping, HTTP error classification, and protocol schema validation.
 */
export class WorkerSyncTransport implements SyncTransport {
  private readonly baseUrl: string;
  private readonly fetchImpl?: typeof fetch;

  constructor(baseUrl: string = '/api', fetchImpl?: typeof fetch) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
  }

  private get fetch(): typeof fetch {
    if (this.fetchImpl) {
      return this.fetchImpl;
    }
    if (typeof fetch !== 'undefined') {
      return fetch.bind(globalThis);
    }
    throw new SyncNetworkError('Global fetch is not available in the current environment');
  }

  /**
   * Pushes batched mutations to the Cloudflare Worker `/api/sync/push` endpoint.
   */
  async push(
    credentials: SessionCredentials,
    request: SyncPushRequest,
    signal?: AbortSignal
  ): Promise<SyncPushResponse> {
    const url = `${this.baseUrl}/sync/push`;
    let response: Response;

    try {
      response = await this.fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': credentials.userId,
          Authorization: `Bearer ${credentials.token}`,
        },
        body: JSON.stringify(request),
        signal,
      });
    } catch (err) {
      if (err instanceof SyncHttpError || err instanceof SyncProtocolError) {
        throw err;
      }
      throw new SyncNetworkError(
        `Sync push failed due to network error: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        const text = await response.text();
        try {
          errorBody = JSON.parse(text);
        } catch {
          errorBody = text;
        }
      } catch {
        errorBody = null;
      }

      const message =
        isRecord(errorBody) && typeof errorBody.error === 'string'
          ? `Sync push failed (${response.status}): ${errorBody.error}`
          : `Sync push failed with HTTP ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`;

      throw new SyncHttpError(response.status, errorBody, message);
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (err) {
      throw new SyncProtocolError(
        `Sync push received malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }

    return validatePushResponse(parsed);
  }

  /**
   * Pulls incremental server changes from `/api/sync/pull`.
   */
  async pull(
    credentials: SessionCredentials,
    cursor: SyncCursor,
    limit: number = 100,
    signal?: AbortSignal
  ): Promise<SyncPullResponse> {
    const url = `${this.baseUrl}/sync/pull?cursor=${encodeURIComponent(String(cursor))}&limit=${encodeURIComponent(String(limit))}`;
    let response: Response;

    try {
      response = await this.fetch(url, {
        method: 'GET',
        headers: {
          'x-user-id': credentials.userId,
          Authorization: `Bearer ${credentials.token}`,
        },
        signal,
      });
    } catch (err) {
      if (err instanceof SyncHttpError || err instanceof SyncProtocolError) {
        throw err;
      }
      throw new SyncNetworkError(
        `Sync pull failed due to network error: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }

    if (!response.ok) {
      let errorBody: unknown;
      try {
        const text = await response.text();
        try {
          errorBody = JSON.parse(text);
        } catch {
          errorBody = text;
        }
      } catch {
        errorBody = null;
      }

      const message =
        isRecord(errorBody) && typeof errorBody.error === 'string'
          ? `Sync pull failed (${response.status}): ${errorBody.error}`
          : `Sync pull failed with HTTP ${response.status}${response.statusText ? ` (${response.statusText})` : ''}`;

      throw new SyncHttpError(response.status, errorBody, message);
    }

    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch (err) {
      throw new SyncProtocolError(
        `Sync pull received malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }

    return validatePullResponse(parsed);
  }
}

/** Singleton instance configured with standard default endpoint `/api`. */
export const workerSyncTransport = new WorkerSyncTransport();
