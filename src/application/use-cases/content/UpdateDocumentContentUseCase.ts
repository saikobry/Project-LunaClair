import type {
  DocumentContentRepository,
  ImportedDocumentContent,
} from '../../../domain/reader/DocumentContentRepository';

export interface UpdateDocumentContentInput {
  documentId: string;
  title: string;
  content: string;
}

/**
 * Updates the locally stored document content (markdown) in Dexie.
 *
 * Content editing is a domain capability owned by the content boundary:
 * Reader consumes document content, Writer edits document content, and
 * future AI features produce document content.
 *
 * Persists directly to `DocumentContentRepository` without coupling to
 * library membership mechanics.
 */
export class UpdateDocumentContentUseCase {
  private readonly documentContentRepository: DocumentContentRepository;

  constructor(documentContentRepository: DocumentContentRepository) {
    this.documentContentRepository = documentContentRepository;
  }

  async execute(input: UpdateDocumentContentInput): Promise<ImportedDocumentContent> {
    if (!input.documentId) {
      throw new Error('documentId is required to update document content');
    }

    const record: ImportedDocumentContent = {
      documentId: input.documentId,
      title: input.title,
      content: input.content,
      updatedAt: new Date().toISOString(),
    };

    await this.documentContentRepository.put(record);
    return record;
  }
}
