import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiDocumentRepository } from '../ApiDocumentRepository';
import { DocumentNotFoundError } from '../../../../domain/reader/errors/DocumentNotFoundError';
import type { StudyMaterial } from '../../../../domain/library/models/StudyMaterial';

describe('ApiDocumentRepository', () => {
  let repo: ApiDocumentRepository;
  const originalFetch = globalThis.fetch;

  const mockMaterial: StudyMaterial = {
    id: 'mat-cardio',
    title: 'Cardiovascular System',
    documentId: 'doc-cardio',
    order: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    repo = new ApiDocumentRepository();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('resolves document and preprocesses figure URLs on 200 OK', async () => {
    const rawContent = '# Cardio\n\n![SA Node](images/sa_node.png)';
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'doc-cardio',
        title: 'Cardiovascular Anatomy',
        content: rawContent,
      }),
    } as unknown as Response);

    const doc = await repo.getDocumentByMaterial(mockMaterial);

    expect(doc.id).toBe('mat-cardio');
    expect(doc.title).toBe('Cardiovascular Anatomy');
    expect(doc.format).toBe('markdown');
    expect(doc.content).toBe('# Cardio\n\n![SA Node](/api/documents/doc-cardio/figures/sa_node.png)');
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/documents/doc-cardio', { signal: undefined });
  });

  it('falls back to material title if data.title is empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'doc-cardio',
        title: '',
        content: '# Cardio Notes',
      }),
    } as unknown as Response);

    const doc = await repo.getDocumentByMaterial(mockMaterial);
    expect(doc.title).toBe('Cardiovascular System');
  });

  it('throws DocumentNotFoundError on non-2xx status code', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    await expect(repo.getDocumentByMaterial(mockMaterial)).rejects.toThrow(DocumentNotFoundError);
  });

  it('throws DocumentNotFoundError on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Network offline'));

    await expect(repo.getDocumentByMaterial(mockMaterial)).rejects.toThrow(DocumentNotFoundError);
  });

  it('throws DocumentNotFoundError when json parsing fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error('Malformed JSON');
      },
    } as unknown as Response);

    await expect(repo.getDocumentByMaterial(mockMaterial)).rejects.toThrow(DocumentNotFoundError);
  });

  it('cleanly rethrows DOMException AbortError on cancellation', async () => {
    const abortErr = new DOMException('The operation was aborted.', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortErr);

    const controller = new AbortController();
    await expect(repo.getDocumentByMaterial(mockMaterial, controller.signal)).rejects.toThrow(
      'The operation was aborted.',
    );
  });
});
