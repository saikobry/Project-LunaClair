import { describe, expect, it, vi } from 'vitest';
import { readSseData } from '../sse';

function sseStream(payloads: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const payload of payloads) controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      controller.close();
    },
  });
}

/** A stream that never ends: the shape an abandoned pull leaves behind. */
function stalledStream(): { stream: ReadableStream<Uint8Array>; cancel: () => Promise<void> } {
  const encoder = new TextEncoder();
  const cancel = vi.fn(async () => undefined);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('data: {"response":"first"}\n\n'));
    },
    cancel,
  });
  return { stream, cancel: cancel as unknown as () => Promise<void> };
}

async function collect(stream: ReadableStream<Uint8Array>, signal?: AbortSignal): Promise<string[]> {
  const payloads: string[] = [];
  for await (const payload of readSseData(stream, signal)) payloads.push(payload);
  return payloads;
}

describe('readSseData', () => {
  it('yields every data payload, including the terminal marker', async () => {
    await expect(collect(sseStream(['{"a":1}', '[DONE]']))).resolves.toEqual(['{"a":1}', '[DONE]']);
  });

  it('ignores comments, blank lines, and other SSE fields', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(': keep-alive\nevent: message\ndata: {"a":1}\n\n'));
        controller.close();
      },
    });

    await expect(collect(stream)).resolves.toEqual(['{"a":1}']);
  });

  it('cancels a pending read when the signal aborts, so the generator can finish', async () => {
    const controller = new AbortController();
    const { stream, cancel } = stalledStream();
    const collected: string[] = [];

    const reading = (async () => {
      for await (const payload of readSseData(stream, controller.signal)) collected.push(payload);
    })();

    // Let the reader consume the first payload and park on the next read, which never resolves.
    await vi.waitFor(() => expect(collected).toEqual(['{"response":"first"}']));

    controller.abort();
    await reading;

    // Cancelling the reader is what settles the pending read; releasing the lock alone would not.
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('cancels immediately when handed an already-aborted signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const { stream, cancel } = stalledStream();

    const collected: string[] = [];
    for await (const payload of readSseData(stream, controller.signal)) collected.push(payload);

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(collected).toEqual([]);
  });

  it('detaches its abort listener once the stream ends', async () => {
    const controller = new AbortController();
    const removeSpy = vi.spyOn(controller.signal, 'removeEventListener');

    await collect(sseStream(['{"a":1}']), controller.signal);

    // A listener left attached would outlive the reader it belongs to.
    expect(removeSpy).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(controller.signal.aborted).toBe(false);
  });
});
