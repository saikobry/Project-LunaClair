import type { AiDocumentContext, AiSelectionContext } from '../../../domain/ai/ai.types';

export interface BuildDocumentContextOptions {
  id?: string;
  title?: string;
  markdown?: string;
  maxCharacters?: number;
}

export interface BuildSelectionContextOptions {
  text?: string;
  surroundingHeading?: string;
  source?: string;
  maxCharacters?: number;
}

/**
 * Centralized context assembler for AI interactions across Reader, Writer, and Quiz.
 */
export class AiContextBuilder {
  private static readonly DEFAULT_MAX_DOC_CHARS = 16000;
  private static readonly DEFAULT_MAX_SELECTION_CHARS = 4000;

  /**
   * Constructs an AiDocumentContext with character limits to avoid context window overflows.
   */
  static buildDocumentContext(options?: BuildDocumentContextOptions): AiDocumentContext | undefined {
    if (!options?.id || !options.markdown) {
      return undefined;
    }

    const maxChars = options.maxCharacters ?? this.DEFAULT_MAX_DOC_CHARS;
    const truncatedMarkdown = options.markdown.length > maxChars
      ? `${options.markdown.slice(0, maxChars)}\n\n[... Remaining content omitted for brevity ...]`
      : options.markdown;

    return {
      id: options.id,
      title: options.title?.trim() || 'Untitled Study Material',
      markdown: truncatedMarkdown,
    };
  }

  /**
   * Constructs an AiSelectionContext with character truncation and sanitization.
   */
  static buildSelectionContext(options?: BuildSelectionContextOptions): AiSelectionContext | undefined {
    if (!options?.text || !options.text.trim()) {
      return undefined;
    }

    const maxChars = options.maxCharacters ?? this.DEFAULT_MAX_SELECTION_CHARS;
    const sanitizedText = options.text.trim();
    const truncatedText = sanitizedText.length > maxChars
      ? `${sanitizedText.slice(0, maxChars)}...`
      : sanitizedText;

    return {
      text: truncatedText,
      surroundingHeading: options.surroundingHeading?.trim(),
      source: options.source?.trim(),
    };
  }
}
