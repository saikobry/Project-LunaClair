/**
 * Reads the `data:` payloads out of an SSE byte stream.
 *
 * Both providers speak SSE but nothing else alike — Workers AI's payloads name generated text as
 * `response`, OpenAI-compatible ones nest it under `choices[0].delta` — so only the line framing is
 * shared. Chunk boundaries are arbitrary, hence the retained partial line: a payload split across
 * two reads must still be parsed exactly once.
 *
 * Yields raw payload strings (including `[DONE]`), leaving "what does this payload mean" to the
 * provider that knows the vocabulary.
 *
 * It accepts a cancellation signal for the same reason the route has one: a pending `reader.read()`
 * is exactly what an abandoned pull leaves behind, and **cancelling the reader is what makes that
 * read resolve** so this generator can run its `finally` instead of being left suspended. Releasing
 * the lock alone does not settle anything.
 */
export async function* readSseData(
  stream: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncIterable<string> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let buffer = '';

  const cancelReader = () => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) cancelReader();
    else signal.addEventListener('abort', cancelReader, { once: true });
  }

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      // The last fragment may be a partial line; keep it for the next read.
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const payload = payloadOf(line);
        if (payload !== undefined) yield payload;
      }
    }

    const trailing = payloadOf(buffer);
    if (trailing !== undefined) yield trailing;
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}

/** Extracts a `data:` payload, ignoring comments, blank lines, and other SSE fields. */
function payloadOf(line: string): string | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return undefined;
  const payload = trimmed.slice(5).trim();
  return payload || undefined;
}
