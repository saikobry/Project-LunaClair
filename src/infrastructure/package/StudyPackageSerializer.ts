import type { StudyPackage } from '../../domain/package/package.types';

export const LUNACLAIR_PACKAGE_MIME_TYPE = 'application/vnd.lunaclair.package+json';
export const PACKAGE_MIME_TYPE = LUNACLAIR_PACKAGE_MIME_TYPE;
export const PACKAGE_JSON_MIME_TYPE = 'application/json';

/**
 * Serializes a StudyPackage domain object into a JSON string.
 * Supports compact (default) and pretty-printed formatting.
 */
export function serializePackageToJson(pkg: StudyPackage, pretty = false): string {
  return pretty ? JSON.stringify(pkg, null, 2) : JSON.stringify(pkg);
}

/**
 * Serializes a StudyPackage domain object into a downloadable or transportable Blob.
 * Defaults to the custom LunaClair package MIME type: application/vnd.lunaclair.package+json.
 */
export function serializePackageToBlob(
  pkg: StudyPackage,
  mimeTypeOrPretty?: string | boolean,
  pretty = false
): Blob {
  let mimeType: string = LUNACLAIR_PACKAGE_MIME_TYPE;
  let isPretty = pretty;

  if (typeof mimeTypeOrPretty === 'boolean') {
    isPretty = mimeTypeOrPretty;
  } else if (typeof mimeTypeOrPretty === 'string') {
    mimeType = mimeTypeOrPretty;
  }

  const jsonString = serializePackageToJson(pkg, isPretty);
  return new Blob([jsonString], { type: mimeType });
}

/**
 * Converts an ArrayBuffer into a Base64-encoded string using chunked buffer processing.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK_SIZE = 0x8000; // 32768
  const chunks: string[] = [];

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }

  return btoa(chunks.join(''));
}

/**
 * Encodes a binary Blob into a standard Base64 string.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof blob.arrayBuffer === 'function') {
    const arrayBuffer = await blob.arrayBuffer();
    return arrayBufferToBase64(arrayBuffer);
  }

  // Handle fake-indexeddb / Node buffer internal properties
  if ((blob as any)._buffer) {
    return arrayBufferToBase64((blob as any)._buffer);
  }

  // Wrap cross-realm or mock blobs in a fresh native Blob instance
  try {
    const standardBlob = new Blob([blob]);
    if (typeof standardBlob.arrayBuffer === 'function') {
      const arrayBuffer = await standardBlob.arrayBuffer();
      return arrayBufferToBase64(arrayBuffer);
    }
    if (typeof FileReader !== 'undefined') {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(standardBlob);
      });
    }
  } catch {
    // Continue to Buffer fallback
  }

  const maybeBuffer = (globalThis as Record<string, unknown>).Buffer as { isBuffer?: (obj: unknown) => boolean } | undefined;
  if (maybeBuffer?.isBuffer?.(blob)) {
    return (blob as { toString: (enc: string) => string }).toString('base64');
  }

  throw new Error('Unable to read Blob as Base64: no arrayBuffer or FileReader available.');
}

/**
 * Converts a Base64 string (raw or data URL) into a binary Uint8Array.
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const cleanBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const binaryString = atob(cleanBase64.trim());
  const len = binaryString.length;
  const buffer = new ArrayBuffer(len);
  const bytes = new Uint8Array(buffer);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}

/**
 * Decodes a Base64 string (raw or data URL) into a binary Blob with the specified MIME type.
 */
export function base64ToBlob(base64: string, mimeType: string): Blob {
  const bytes = base64ToUint8Array(base64);
  return new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
}
