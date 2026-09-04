/**
 * Path and binary data sanitization primitives for the LunaClair Worker.
 */

/**
 * Decode one path segment and reject anything that could traverse or escape.
 * Returns null if the segment is invalid or contains traversal characters.
 */
export function decodeSegment(raw: string): string | null {
  try {
    const decoded = decodeURIComponent(raw);
    if (decoded.includes('/') || decoded.includes('\\') || decoded === '..') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Safely converts untyped data or array buffer representations into a Uint8Array.
 */
export function toUint8Array(data: unknown): Uint8Array {
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (Array.isArray(data)) return new Uint8Array(data);
  if (
    data &&
    typeof data === 'object' &&
    'buffer' in data &&
    (data as { buffer: unknown }).buffer instanceof ArrayBuffer
  ) {
    const b = data as { buffer: ArrayBuffer; byteOffset?: number; byteLength?: number };
    return new Uint8Array(b.buffer, b.byteOffset ?? 0, b.byteLength ?? b.buffer.byteLength);
  }
  return new Uint8Array();
}
