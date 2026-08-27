/**
 * Safely parses raw JSON text into an unknown candidate object for domain validation.
 */
export function parsePackageFromJson(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to parse .lcpack JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Safely parses a package Blob into an unknown candidate object.
 */
export async function parsePackageFromBlob(blob: Blob): Promise<unknown> {
  if (typeof blob.text === 'function') {
    const text = await blob.text();
    return parsePackageFromJson(text);
  }
  if (typeof FileReader !== 'undefined') {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    return parsePackageFromJson(text);
  }
  throw new Error('Unable to read Blob as text: no text() or FileReader available.');
}

/**
 * Safely parses a binary Uint8Array into an unknown candidate object.
 */
export function parsePackageFromUint8Array(bytes: Uint8Array): unknown {
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(bytes);
  return parsePackageFromJson(text);
}
