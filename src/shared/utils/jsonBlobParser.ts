/**
 * Safely parses raw JSON text into an unknown candidate object.
 */
export function parseJsonFromString(jsonString: string): unknown {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Safely parses a JSON Blob into an unknown candidate object.
 */
export async function parseJsonFromBlob(blob: Blob): Promise<unknown> {
  if (typeof blob.text === 'function') {
    const text = await blob.text();
    return parseJsonFromString(text);
  }
  if (typeof FileReader !== 'undefined') {
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(blob);
    });
    return parseJsonFromString(text);
  }
  throw new Error('Unable to read Blob as text: no text() or FileReader available.');
}

/**
 * Safely parses a binary Uint8Array containing UTF-8 JSON into an unknown candidate object.
 */
export function parseJsonFromBytes(bytes: Uint8Array): unknown {
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(bytes);
  return parseJsonFromString(text);
}
