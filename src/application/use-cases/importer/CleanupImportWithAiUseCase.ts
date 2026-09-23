import type { AiService } from '../../../domain/ai/services/AiService';
import type { AiChatMessage, AiUsage } from '../../../domain/ai/models/ai.types';
import type { AiModelCatalog, AiModelDescriptor } from '../../../domain/ai/services/aiModelCatalog';
import {
  DEFAULT_AI_MODEL_CATALOG,
  getAiModelDescriptor,
} from '../../../domain/ai/services/aiModelCatalog';
import {
  DEFAULT_TARGET_CHUNK_CHARS,
  chunkDocument,
  extractDocumentOutline,
  type DocumentChunk,
} from '../../../domain/importer/services/DocumentChunker';

export interface AiCleanupResult {
  /** The original Markdown (unchanged) */
  original: string;
  /** The AI-cleaned Markdown */
  cleaned: string;
}

/**
 * Progress of a multi-section cleanup run.
 *
 * Every field is present for both phases so the review step's status label can render from one
 * value without deriving anything — the same contract the extraction progress already uses.
 */
export interface AiCleanupProgress {
  /** `cleaning` = a section is being sent; `cooldown` = waiting out a provider rate limit. */
  phase: 'cleaning' | 'cooldown';
  /** 1-based index of the section this update is about. */
  current: number;
  total: number;
  percent: number;
  label: string;
}

export interface CleanupImportRequest {
  markdown: string;
  title?: string;
  model?: string;
  catalog?: AiModelCatalog;
  signal?: AbortSignal;
  /** Emitted before each section request and while waiting out a rate limit. */
  onProgress?: (progress: AiCleanupProgress) => void;
}

/**
 * Raised when a chunked cleanup fails after at least one section was already cleaned.
 *
 * The cleaned sections are attached so the failure is resumable rather than merely fatal: nothing
 * has been written anywhere, and re-running the whole document would spend the shared model's rate
 * limit on work already done. `retryCleanupRemaining()` consumes that cache.
 */
export class AiCleanupPartialError extends Error {
  readonly partialChunks: string[];
  readonly failedIndex: number;

  constructor(message: string, partialChunks: string[], failedIndex: number) {
    super(message);
    this.name = 'AiCleanupPartialError';
    this.partialChunks = partialChunks;
    this.failedIndex = failedIndex;
  }
}

/** Minimum spacing between section requests, in milliseconds. */
export const AI_CLEANUP_MIN_REQUEST_SPACING_MS = 12_000;

/** Rate-limit retries per section before the run gives up on that section. */
const AI_CLEANUP_MAX_RATE_LIMIT_RETRIES = 2;

/** Wait used when a rate limit does not state one. */
const AI_CLEANUP_FALLBACK_RETRY_AFTER_SECONDS = 12;

/** Characters of the already-cleaned text carried into the next section for tone continuity. */
const AI_CLEANUP_PRECEDING_SNIPPET_CHARS = 500;

/**
 * Characters of Markdown one output token buys.
 *
 * The project's own markdown estimate (`aiContextBudget`): 3, below the 4-char prose average,
 * because markdown, identifiers, and table pipes tokenize denser than prose.
 */
const AI_CLEANUP_MARKDOWN_CHARS_PER_TOKEN = 3;

/**
 * Share of the output reservation a cleaned section may occupy.
 *
 * Cleanup output is roughly input-sized but not identically sized — a model that expands a list or
 * pads a table would otherwise reach the ceiling on the very section sized to fill it. The
 * remaining third is deliberate slack.
 */
const AI_CLEANUP_OUTPUT_HEADROOM = 0.65;

/**
 * Section size the serving model can actually round-trip.
 *
 * Derived from the model's **output** reservation, which is the binding constraint: cleanup output
 * is ~input, so the output limit — not the context window — decides how much a section may hold.
 * This is why MAX's 256k window buys nothing here, and why the default size is a default rather
 * than a fixed rule: a future model with a larger reservation gets larger sections automatically.
 */
function resolveChunkTarget(descriptor: AiModelDescriptor): number {
  const roundTrippable = Math.floor(
    descriptor.maxOutputTokens * AI_CLEANUP_MARKDOWN_CHARS_PER_TOKEN * AI_CLEANUP_OUTPUT_HEADROOM,
  );
  return Math.max(200, Math.min(DEFAULT_TARGET_CHUNK_CHARS, roundTrippable));
}

/** Single-request system prompt: the whole document is the request. */
const SINGLE_SYSTEM_PROMPT = `Convert OCR text into clean Markdown.
DO NOT summarize. DO NOT remove information. Preserve all content.
Fix spelling only when confidence is obvious.
Use headings, lists, and tables where appropriate.
Convert any tab-separated, whitespace-aligned, or visual tabular data into standard GitHub-Flavored Markdown tables with pipe columns (| Col 1 | Col 2 |) and header separators (| --- | --- |). Escape literal pipe characters. Never alter or reformat fenced code blocks.
Preserve list numbering and bullet hierarchy. If items appear as '## 1.' or raw numbered lines, format them as clean Markdown ordered lists (1. , 2. ) or bullet lists (- ). Do NOT strip list numbers into bare unbulleted paragraphs.
Return ONLY the cleaned Markdown, no explanations or commentary.`;

/** Sectioned system prompt: the request carries one section of a larger document. */
const SECTIONED_SYSTEM_PROMPT = `Convert OCR text into clean Markdown, one section at a time.
DO NOT summarize. DO NOT remove information. Preserve all content of the target section.
Do NOT quote, continue, summarize, or reproduce text from <document_background>. Treat it strictly as read-only vocabulary and tone reference.
Fix spelling only when confidence is obvious.
Use headings, lists, and tables where appropriate.
Convert any tab-separated, whitespace-aligned, or visual tabular data into standard GitHub-Flavored Markdown tables with pipe columns (| Col 1 | Col 2 |) and header separators (| --- | --- |). Escape literal pipe characters. Never alter or reformat fenced code blocks.
Preserve list numbering and bullet hierarchy. If items appear as '## 1.' or raw numbered lines, format them as clean Markdown ordered lists (1. , 2. ) or bullet lists (- ). Do NOT strip list numbers into bare unbulleted paragraphs.
Format lettered sub-items (e.g., a., b., c.) and numbered points on their own separate lines as vertical Markdown lists (e.g., - a. ...).
Strip isolated, recurring document-control headers or footers at page transitions (such as repeated document numbers, effectivity dates, quality policy notices), but preserve actual tables and document data.
Return ONLY the cleaned Markdown for the target section, no explanations or commentary.`;

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error('Aborted'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbortError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message === 'Aborted' || err.name === 'AbortError' || err.name === 'TimeoutError')
  );
}

/** True for a provider refusal that named a wait, or one whose message reads like a rate limit. */
function isRateLimited(err: unknown): boolean {
  const candidate = err as { code?: string; message?: string };
  if (candidate?.code === 'RATE_LIMITED') return true;
  return /rate limit|too many requests|429/i.test(candidate?.message ?? '');
}

function retryAfterSeconds(err: unknown): number {
  const candidate = err as { retryAfterSeconds?: number };
  if (typeof candidate?.retryAfterSeconds === 'number' && candidate.retryAfterSeconds > 0) {
    return candidate.retryAfterSeconds;
  }
  return AI_CLEANUP_FALLBACK_RETRY_AFTER_SECONDS;
}

const MAX_SEAM_OVERLAP_CHARS = 300;
const MIN_SEAM_OVERLAP_NON_WHITESPACE = 20;

/**
 * Extracts a preceding context snippet guaranteed to consist of complete sentences and/or
 * paragraph boundaries.
 *
 * Prevents the LLM from receiving incomplete sentence fragments at the start or end of the
 * background context, which would cause it to echo or regenerate duplicate paragraphs.
 */
export function extractSafePrecedingSnippet(
  cleanedText: string,
  maxChars = AI_CLEANUP_PRECEDING_SNIPPET_CHARS,
): string {
  if (!cleanedText || maxChars <= 0) return '';

  let candidate: string;

  if (cleanedText.length <= maxChars) {
    candidate = cleanedText.trim();
  } else {
    const tail = cleanedText.slice(-maxChars);
    const firstSentenceBreak = tail.match(/[.!?][)"'*_~]*(?:[ \t]*\r?\n|[ \t]+)/);
    if (!firstSentenceBreak || firstSentenceBreak.index === undefined) {
      return '';
    }
    candidate = tail.slice(firstSentenceBreak.index + firstSentenceBreak[0].length).trimStart();
  }

  if (!candidate) return '';

  const endsOnSentenceOrParagraph =
    /[.!?][)"'*_~]*\s*$/.test(candidate) || /(?:\r?\n\s*)$/.test(candidate);

  if (!endsOnSentenceOrParagraph) {
    const matches = [
      ...candidate.matchAll(/[.!?][)"'*_~]*(?:\s+|$)|(?:\r?\n\s*\r?\n)/g),
    ];
    const lastBoundary = matches.pop();
    if (!lastBoundary || lastBoundary.index === undefined) {
      return '';
    }
    candidate = candidate.slice(0, lastBoundary.index + lastBoundary[0].length).trimEnd();
  }

  if (!candidate || !/[.!?]|\n\n/.test(candidate)) {
    return '';
  }

  return candidate.trim();
}

/**
 * Trims conservative line or paragraph overlap at the seam between `assembled` and `current`.
 *
 * If the trailing text of `assembled` (up to 300 chars) and the leading text of `current`
 * share an exact line or multi-line overlap (at least 20 non-whitespace chars or a complete paragraph),
 * slices off the duplicated leading text from `current`.
 */
function trimSeamOverlap(assembled: string, current: string): string {
  const assembledTrimmed = assembled.trimEnd();
  const currentTrimmed = current.trimStart();

  if (!assembledTrimmed || !currentTrimmed) return current;

  const rawAssembledLines = assembledTrimmed.split('\n');
  const rawCurrentLines = currentTrimmed.split('\n');

  const maxLinesToCheck = Math.min(rawAssembledLines.length, rawCurrentLines.length, 10);
  const normalize = (line: string) => line.replace(/\s+/g, ' ').trim();

  let matchedLineCount = 0;
  let matchedCurrentCharLength = 0;

  for (let n = maxLinesToCheck; n >= 1; n -= 1) {
    const assembledLinesSlice = rawAssembledLines.slice(-n);
    const currentLinesSlice = rawCurrentLines.slice(0, n);

    const assembledBlock = assembledLinesSlice.join('\n');
    const currentBlock = currentLinesSlice.join('\n');

    if (
      assembledBlock.length > MAX_SEAM_OVERLAP_CHARS ||
      currentBlock.length > MAX_SEAM_OVERLAP_CHARS
    ) {
      continue;
    }

    let allLinesMatch = true;
    for (let i = 0; i < n; i += 1) {
      if (normalize(assembledLinesSlice[i]) !== normalize(currentLinesSlice[i])) {
        allLinesMatch = false;
        break;
      }
    }

    if (!allLinesMatch) continue;

    const nonWsCount = currentBlock.replace(/\s/g, '').length;
    const isCompleteParagraph =
      n < rawCurrentLines.length &&
      rawCurrentLines[n].trim() === '' &&
      /[.!?][)"'*_~]*$/.test(currentBlock.trim());

    if (nonWsCount >= MIN_SEAM_OVERLAP_NON_WHITESPACE || isCompleteParagraph) {
      matchedLineCount = n;
      matchedCurrentCharLength = currentLinesSlice.join('\n').length;
      break;
    }
  }

  if (matchedLineCount > 0 && matchedCurrentCharLength > 0) {
    return currentTrimmed.slice(matchedCurrentCharLength).replace(/^\n+/, '');
  }

  return current;
}

/**
 * Normalizes a heading or title line by stripping leading `#{1,6}\s*`, surrounding bold `**`,
 * and trimming whitespace.
 */
export function normalizeTitle(line: string): string {
  let s = line.trim();
  s = s.replace(/^#{1,6}\s*/, '').trim();
  s = s.replace(/^\*\*(.*?)\*\*$/, '$1').trim();
  s = s.replace(/^#{1,6}\s*/, '').trim();
  return s;
}

/**
 * Checks whether a line qualifies as a heading or title candidate based on markdown heading
 * markers, bold formatting delimiters, or numbered/labeled section prefixes.
 */
export function isHeadingOrTitleCandidate(raw: string, norm: string): boolean {
  if (raw !== norm) return true;
  if (/^(?:\d+(?:\.\d+)*\.?|[A-Z]\.|(?:Section|Chapter|Part|Appendix|Clause)\b)/i.test(norm)) {
    return true;
  }
  return false;
}

/**
 * Deduplicates isolated seam headings/titles between the tail of `assembled` and the start of `nextChunk`.
 * Compares the last non-empty line of `assembled` with the first non-empty line of `nextChunk`.
 * If they match after stripping leading markdown heading markers and bold delimiters, and the title
 * appears isolated (followed or preceded by a newline), slices off the duplicate opening line.
 */
export function deduplicateSeamHeading(assembled: string, nextChunk: string): string {
  const assembledTrimmed = assembled.trimEnd();
  const nextChunkTrimmed = nextChunk.trimStart();
  if (!assembledTrimmed || !nextChunkTrimmed) return nextChunk;

  const assembledLines = assembledTrimmed.split('\n');
  const nextChunkLines = nextChunkTrimmed.split('\n');

  const lastLine = assembledLines[assembledLines.length - 1].trim();
  const firstLine = nextChunkLines[0].trim();

  const normLast = normalizeTitle(lastLine);
  const normFirst = normalizeTitle(firstLine);

  if (normLast && normFirst && normLast === normFirst) {
    if (
      !isHeadingOrTitleCandidate(lastLine, normLast) &&
      !isHeadingOrTitleCandidate(firstLine, normFirst)
    ) {
      return nextChunk;
    }

    const isLastIsolated =
      assembledLines.length === 1 ||
      assembledLines[assembledLines.length - 2]?.trim() === '' ||
      /^#{1,6}\s/.test(lastLine);

    const isFirstIsolated =
      nextChunkLines.length === 1 ||
      nextChunkLines[1]?.trim() === '' ||
      /^#{1,6}\s/.test(firstLine);

    if (isLastIsolated || isFirstIsolated) {
      return nextChunkLines.slice(1).join('\n').replace(/^\n+/, '');
    }
  }

  return nextChunk;
}

/**
 * Checks if a trailing line is an incomplete prose line eligible for dangling tail pruning.
 * Requires:
 * - Length >= 15 characters.
 * - Does NOT end with sentence punctuation ([.!?:]), markdown table pipe (|), code fence (``` or ~~~),
 *   horizontal rule (---), or list marker.
 * - Does NOT start with a heading (#), list marker (- , * , \d+\. ), table pipe (|), or blockquote (>).
 */
export function isProseTailLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 15) return false;

  // Does NOT end with sentence punctuation ([.!?:]), markdown table pipe (|),
  // code fence (``` or ~~~), horizontal rule (---), or list marker.
  if (/[.!?:]$/.test(trimmed)) return false;
  if (/\|$/.test(trimmed)) return false;
  if (/(`{3,}|~{3,})$/.test(trimmed)) return false;
  if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed) || /(?:---|===)$/.test(trimmed)) return false;
  if (/(?:^|\s)(?:[-*+]|\d+\.|[a-zA-Z]\.)$/.test(trimmed)) return false;

  // Does NOT start with a heading (#), list marker (- , * , \d+\. , a. ), table pipe (|), or blockquote (>).
  if (/^#{1,6}\s/.test(trimmed)) return false;
  if (/^(?:[-*+]|\d+\.|[a-zA-Z]\.)\s/.test(trimmed)) return false;
  if (/^\|/.test(trimmed)) return false;
  if (/^>/.test(trimmed)) return false;

  return true;
}

/**
 * Conservative dangling tail pruning at chunk seam.
 * If the trailing non-blank line of `assembled` is a prose line and is a strict proper prefix of
 * `nextChunk`'s opening line (meaning `nextChunk`'s opening line starts with the exact text of
 * `assembled`'s trailing line, followed by a space or word continuation), prunes that trailing
 * dangling line from `assembled` before joining.
 */
export function pruneDanglingTail(assembled: string, nextChunk: string): string {
  const assembledTrimmed = assembled.trimEnd();
  const nextChunkTrimmed = nextChunk.trimStart();
  if (!assembledTrimmed || !nextChunkTrimmed) return assembled;

  const assembledLines = assembledTrimmed.split('\n');
  const lastLineIndex = assembledLines.length - 1;
  const lastLine = assembledLines[lastLineIndex].trim();

  if (!isProseTailLine(lastLine)) {
    return assembled;
  }

  const nextChunkLines = nextChunkTrimmed.split('\n');
  const firstLine = nextChunkLines[0].trim();

  if (
    firstLine.length > lastLine.length &&
    firstLine.startsWith(lastLine) &&
    (firstLine[lastLine.length] === ' ' || !/\s/.test(firstLine[lastLine.length]))
  ) {
    return assembledLines.slice(0, lastLineIndex).join('\n').trimEnd();
  }

  return assembled;
}

/**
 * Joins cleaned sections into one document.
 *
 * Heading deduplication: when the previous piece ends with the same heading the next piece begins
 * with, the repetition is dropped from the later piece.
 *
 * Seam heading / title deduplication: when the tail of assembled ends with the same heading or bold
 * title as the opening line of the incoming piece, the duplicate title is sliced off.
 *
 * Conservative dangling tail pruning: when the trailing non-blank line of assembled is an incomplete
 * prose fragment that forms a strict proper prefix of the incoming piece's opening line, the dangling
 * tail is pruned from assembled before joining.
 *
 * Seam overlap deduplication: when the tail of what has already been assembled matches the leading
 * text of the incoming piece (e.g., from prompt context echoing or boundary overlap), the duplicated
 * lines/paragraphs are conservatively sliced off.
 */
export function assembleCleanedChunks(cleanedChunks: string[]): string {
  return cleanedChunks.reduce((assembled, current, index) => {
    if (index === 0) return current;

    let nextChunk = current;

    const previousHeading = assembled.match(/^(#{1,6}\s+.+)$/gm)?.pop();
    const openingHeading = nextChunk.match(/^(#{1,6}\s+.+)/);
    if (
      previousHeading &&
      openingHeading &&
      previousHeading.trim() === openingHeading[1].trim()
    ) {
      nextChunk = nextChunk.slice(openingHeading[0].length).replace(/^\n+/, '');
    }

    nextChunk = deduplicateSeamHeading(assembled, nextChunk);

    assembled = pruneDanglingTail(assembled, nextChunk);

    nextChunk = trimSeamOverlap(assembled, nextChunk);

    if (!nextChunk) {
      return assembled;
    }

    if (!assembled) {
      return nextChunk;
    }

    return `${assembled}\n\n${nextChunk}`;
  }, '');
}

/** Trims, unwraps an outer code fence, and rejects an empty answer. */
function normalizeResponse(text: string): string {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/^```(?:markdown)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }
  return cleaned;
}

interface RunSectionOptions {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  signal?: AbortSignal;
  descriptor: AiModelDescriptor;
}

export class CleanupImportWithAiUseCase {
  private readonly aiService: AiService;
  private readonly minRequestSpacingMs: number;

  /**
   * Cache for `retryCleanupRemaining()`: the sections already cleaned when a chunked run failed.
   * Holds no document copy beyond what the in-flight run needed, and is cleared by any new run.
   */
  private resume: {
    markdown: string;
    title?: string;
    model?: string;
    descriptor: AiModelDescriptor;
    cleanedChunks: string[];
    failedIndex: number;
  } | null = null;

  constructor(aiService: AiService, minRequestSpacingMs = AI_CLEANUP_MIN_REQUEST_SPACING_MS) {
    this.aiService = aiService;
    this.minRequestSpacingMs = minRequestSpacingMs;
  }

  async execute(request: CleanupImportRequest): Promise<AiCleanupResult>;
  async execute(
    markdown: string,
    title?: string,
    options?: {
      model?: string;
      catalog?: AiModelCatalog;
      signal?: AbortSignal;
      onProgress?: (progress: AiCleanupProgress) => void;
    },
  ): Promise<AiCleanupResult>;
  async execute(
    markdownOrRequest: string | CleanupImportRequest,
    title?: string,
    options?: {
      model?: string;
      catalog?: AiModelCatalog;
      signal?: AbortSignal;
      onProgress?: (progress: AiCleanupProgress) => void;
    },
  ): Promise<AiCleanupResult> {
    const isRequestObj = typeof markdownOrRequest !== 'string';
    const markdown = isRequestObj ? markdownOrRequest.markdown : markdownOrRequest;
    const reqTitle = isRequestObj ? markdownOrRequest.title : title;
    const model = isRequestObj ? markdownOrRequest.model : options?.model;
    const catalog = (isRequestObj ? markdownOrRequest.catalog : options?.catalog) ?? DEFAULT_AI_MODEL_CATALOG;
    const signal = isRequestObj ? markdownOrRequest.signal : options?.signal;
    const onProgress = isRequestObj ? markdownOrRequest.onProgress : options?.onProgress;

    const descriptor = getAiModelDescriptor(catalog, model);

    // A new run supersedes any resumable failure from an earlier one.
    this.resume = null;

    const chunks = chunkDocument(markdown, { targetChunkChars: resolveChunkTarget(descriptor) });

    if (chunks.length <= 1) {
      return this.cleanupWholeDocument({ markdown, title: reqTitle, model, signal, descriptor });
    }

    return this.cleanupChunked({
      markdown,
      title: reqTitle,
      model,
      signal,
      descriptor,
      chunks,
      startIndex: 0,
      initialCleaned: [],
      onProgress,
    });
  }

  /** True when a chunked run failed after cleaning at least one section and can be resumed. */
  hasPendingCleanupResume(): boolean {
    return this.resume !== null;
  }

  /**
   * Resumes an interrupted chunked cleanup at the section that failed.
   *
   * The sections cleaned by the failed run are reused rather than re-sent: on a shared, rate-limited
   * model the expensive part is the requests, so a resume that started over would cost the user
   * exactly what the failure already cost them.
   */
  async retryCleanupRemaining(options?: {
    signal?: AbortSignal;
    onProgress?: (progress: AiCleanupProgress) => void;
  }): Promise<AiCleanupResult> {
    const resume = this.resume;
    if (!resume) {
      throw new Error('There is no interrupted AI cleanup to resume.');
    }

    const chunks = chunkDocument(resume.markdown, {
      targetChunkChars: resolveChunkTarget(resume.descriptor),
    });

    return this.cleanupChunked({
      markdown: resume.markdown,
      title: resume.title,
      model: resume.model,
      signal: options?.signal,
      descriptor: resume.descriptor,
      chunks,
      startIndex: resume.failedIndex,
      initialCleaned: resume.cleanedChunks,
      onProgress: options?.onProgress,
    });
  }

  /** Drops any resumable cache — used when the caller abandons the run. */
  clearPendingCleanupResume(): void {
    this.resume = null;
  }

  /** One request for the whole document; the path a short document takes. */
  private async cleanupWholeDocument(input: {
    markdown: string;
    title?: string;
    model?: string;
    signal?: AbortSignal;
    descriptor: AiModelDescriptor;
  }): Promise<AiCleanupResult> {
    const { markdown, title, model, signal, descriptor } = input;

    if (markdown.length > descriptor.maxDocumentContextChars) {
      throw new Error(
        'Document is too large for AI cleanup. Please edit manually or clean in smaller sections.',
      );
    }

    const cleaned = await this.runSection({
      systemPrompt: SINGLE_SYSTEM_PROMPT,
      userPrompt: title ? `# ${title}\n\n${markdown}` : markdown,
      model,
      signal,
      descriptor,
    });

    return { original: markdown, cleaned };
  }

  /** Sequential, paced section requests assembled into one document. */
  private async cleanupChunked(input: {
    markdown: string;
    title?: string;
    model?: string;
    signal?: AbortSignal;
    descriptor: AiModelDescriptor;
    chunks: DocumentChunk[];
    startIndex: number;
    initialCleaned: string[];
    onProgress?: (progress: AiCleanupProgress) => void;
  }): Promise<AiCleanupResult> {
    const { markdown, title, model, signal, descriptor, chunks, startIndex, initialCleaned, onProgress } = input;
    const outline = extractDocumentOutline(markdown);
    const cleanedChunks = [...initialCleaned];
    let lastRequestStart = 0;

    for (let index = startIndex; index < chunks.length; index += 1) {
      const chunk = chunks[index];

      if (signal?.aborted) {
        throw new Error('Aborted');
      }

      const elapsed = Date.now() - lastRequestStart;
      if (lastRequestStart > 0 && elapsed < this.minRequestSpacingMs) {
        await abortableSleep(this.minRequestSpacingMs - elapsed, signal);
      }

      // The sentence-safe tail of what has already been cleaned — complete sentences only,
      // avoiding fragments that cause the LLM to echo or regenerate duplicate paragraphs.
      const precedingCleaned =
        cleanedChunks.length > 0
          ? extractSafePrecedingSnippet(
              assembleCleanedChunks(cleanedChunks),
              AI_CLEANUP_PRECEDING_SNIPPET_CHARS,
            )
          : '';

      const userPrompt = this.buildSectionPrompt({
        title,
        outline,
        chunk,
        total: chunks.length,
        precedingCleaned,
      });
      const percent = Math.round((index / chunks.length) * 100);

      if (userPrompt.length > descriptor.maxDocumentContextChars) {
        throw new Error(
          `Section ${index + 1} of ${chunks.length} is too large for AI cleanup on this model. Clean it in smaller sections or pick a model with a larger context.`,
        );
      }

      onProgress?.({
        phase: 'cleaning',
        current: index + 1,
        total: chunks.length,
        percent,
        label: `Cleaning section ${index + 1} of ${chunks.length}...`,
      });

      let attempts = 0;
      for (;;) {
        try {
          lastRequestStart = Date.now();
          const cleaned = await this.runSection({
            systemPrompt: SECTIONED_SYSTEM_PROMPT,
            userPrompt,
            model,
            signal,
            descriptor,
          });
          cleanedChunks.push(cleaned);
          break;
        } catch (err: unknown) {
          if (isAbortError(err) || signal?.aborted) {
            throw err;
          }

          if (isRateLimited(err) && attempts < AI_CLEANUP_MAX_RATE_LIMIT_RETRIES) {
            attempts += 1;
            const waitSeconds = retryAfterSeconds(err);
            onProgress?.({
              phase: 'cooldown',
              current: index + 1,
              total: chunks.length,
              percent,
              label: `Rate limited. Cooling down for ${Math.ceil(waitSeconds)}s (attempt ${attempts} of ${AI_CLEANUP_MAX_RATE_LIMIT_RETRIES})...`,
            });
            await abortableSleep(waitSeconds * 1000, signal);
            continue;
          }

          // Nothing to resume from when the first section is the one that failed.
          if (cleanedChunks.length === 0) {
            throw err;
          }

          this.resume = {
            markdown,
            title,
            model,
            descriptor,
            cleanedChunks: [...cleanedChunks],
            failedIndex: index,
          };
          const message = err instanceof Error ? err.message : 'AI cleanup failed.';
          throw new AiCleanupPartialError(message, [...cleanedChunks], index);
        }
      }
    }

    this.resume = null;
    return { original: markdown, cleaned: assembleCleanedChunks(cleanedChunks) };
  }

  /**
   * The section request prompt: the document's identity and shape, the text already cleaned (for
   * tone continuity), then the one section to clean.
   *
   * The background is explicitly *not* to be reproduced. A model asked to "clean this document"
   * while being shown the outline will happily rebuild the whole document from the outline, which
   * would duplicate content on every section.
   */
  private buildSectionPrompt(input: {
    title?: string;
    outline: string;
    chunk: DocumentChunk;
    total: number;
    precedingCleaned: string;
  }): string {
    const { title, outline, chunk, total, precedingCleaned } = input;

    return [
      '<document_background>',
      `Document Title: ${title ?? 'Untitled document'}`,
      'Document Outline:',
      outline || '(no headings)',
      '',
      `Preceding Cleaned Snippet (last ${AI_CLEANUP_PRECEDING_SNIPPET_CHARS} chars for tone/style continuity):`,
      precedingCleaned || '(this is the first section)',
      '</document_background>',
      '',
      '<target_section_to_clean>',
      chunk.content,
      '</target_section_to_clean>',
      '',
      'Instructions:',
      '1. Clean ONLY the text inside <target_section_to_clean>. Correct OCR typos, format tables, and fix headers.',
      '2. Do NOT quote, continue, summarize, or reproduce text from <document_background>. Treat it strictly as read-only vocabulary and tone reference.',
      `3. This is Section ${chunk.index + 1} of ${total}.`,
      `4. ${chunk.index === 0 ? 'Retain document title if present.' : 'Do NOT output a document title (# Title) or summary.'}`,
      '5. Preserve exact heading levels (do not promote ### to ##).',
      '6. Convert any tab-separated, whitespace-aligned, or visual tabular data into standard GitHub-Flavored Markdown tables with pipe columns (| Col 1 | Col 2 |) and header separators (| --- | --- |). Escape literal pipe characters. Never alter or reformat fenced code blocks.',
      "7. Preserve list numbering and bullet hierarchy. If items appear as '## 1.' or raw numbered lines, format them as clean Markdown ordered lists (1. , 2. ) or bullet lists (- ). Do NOT strip list numbers into bare unbulleted paragraphs.",
      '8. Format lettered sub-items (e.g., a., b., c.) and numbered points on their own separate lines as vertical Markdown lists (e.g., - a. ...).',
      '9. Strip isolated, recurring document-control headers or footers at page transitions (such as repeated document numbers, effectivity dates, quality policy notices), but preserve actual tables and document data.',
      '10. Preserve code blocks verbatim.',
      '11. Output pure markdown with zero commentary.',
    ].join('\n');
  }

  /** Streams one request and returns the cleaned text, rejecting truncation and empty answers. */
  private async runSection(options: RunSectionOptions): Promise<string> {
    const { systemPrompt, userPrompt, model, signal, descriptor } = options;

    const messages: AiChatMessage[] = [
      {
        id: 'sys',
        role: 'system',
        content: systemPrompt,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'usr',
        role: 'user',
        content: userPrompt,
        createdAt: new Date().toISOString(),
      },
    ];

    let accumulatedText = '';
    let lastUsage: AiUsage | undefined;

    for await (const event of this.aiService.streamChat({
      messages,
      mode: 'assistant',
      model,
      signal,
    })) {
      if (event.type === 'token') {
        accumulatedText += event.text;
      } else if (event.type === 'done') {
        if (event.usage) {
          lastUsage = event.usage;
        }
      } else if (event.type === 'error') {
        const err = new Error(event.message) as Error & { code?: string; retryAfterSeconds?: number };
        if (event.code) err.code = event.code;
        if (typeof event.retryAfterSeconds === 'number') err.retryAfterSeconds = event.retryAfterSeconds;
        throw err;
      }
    }

    if (
      typeof lastUsage?.completionTokens === 'number' &&
      lastUsage.completionTokens >= descriptor.maxOutputTokens
    ) {
      throw new Error(
        `AI cleanup was cut off at the model output limit (${descriptor.maxOutputTokens} tokens). Original document preserved.`,
      );
    }

    const cleaned = normalizeResponse(accumulatedText);
    if (!cleaned) {
      throw new Error('AI cleanup returned an empty response.');
    }

    return cleaned;
  }
}
