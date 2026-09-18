/** URI scheme of a locally stored document asset reference (`lc-asset://{assetId}`). */
export const ASSET_REFERENCE_SCHEME = 'lc-asset://';

/**
 * Extracts the asset id from a document asset reference.
 *
 * Syntax only, and deliberately narrow: `lc-asset://{assetId}` resolves to `assetId`; everything
 * else — an absolute URL, a relative path, a missing src, or the bare scheme with no id — is not
 * this function's business and yields `undefined`, so the caller leaves the reference untouched.
 *
 * It never queries storage, never sees `materialId`, and carries no package concepts: resolving an
 * id to a stored blob is the reader's job, and the id is the only identity a document reference
 * holds. The scheme match is case-sensitive — published content is generated, never hand-typed, and
 * guessing at casing variants would resolve references the document did not actually make.
 */
export function parseAssetReference(src: string | undefined): string | undefined {
  if (!src || !src.startsWith(ASSET_REFERENCE_SCHEME)) return undefined;

  const assetId = src.slice(ASSET_REFERENCE_SCHEME.length);
  return assetId.length > 0 ? assetId : undefined;
}
