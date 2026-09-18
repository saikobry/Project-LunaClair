import { describe, it, expect } from 'vitest';
import { ASSET_REFERENCE_SCHEME, parseAssetReference } from '../assetReference';

describe('parseAssetReference', () => {
  it('extracts the asset id from an lc-asset reference', () => {
    expect(parseAssetReference('lc-asset://abc')).toBe('abc');
    expect(parseAssetReference('lc-asset://f1e2d3c4-0000-4000-8000-000000000001')).toBe(
      'f1e2d3c4-0000-4000-8000-000000000001',
    );
  });

  it('returns the raw id even when nothing resolves to it', () => {
    // Resolution is the reader's concern — an unknown id must survive parsing so the caller can
    // report a missing asset rather than silently treating the reference as a plain URL.
    expect(parseAssetReference('lc-asset://unknown')).toBe('unknown');
  });

  it('leaves non-asset references untouched', () => {
    expect(parseAssetReference('https://example.com/figure.png')).toBeUndefined();
    expect(parseAssetReference('/images/foo.png')).toBeUndefined();
    expect(parseAssetReference('./figure.png')).toBeUndefined();
    expect(parseAssetReference('blob:http://localhost/abc')).toBeUndefined();
    expect(parseAssetReference('data:image/png;base64,AAAA')).toBeUndefined();
  });

  it('treats a missing or empty src as no reference', () => {
    expect(parseAssetReference(undefined)).toBeUndefined();
    expect(parseAssetReference('')).toBeUndefined();
    expect(parseAssetReference('lc-asset://')).toBeUndefined();
  });

  it('does not guess at scheme casing or lookalike prefixes', () => {
    expect(parseAssetReference('LC-ASSET://abc')).toBeUndefined();
    expect(parseAssetReference('lc-assets://abc')).toBeUndefined();
    expect(parseAssetReference('https://host/lc-asset://abc')).toBeUndefined();
  });

  it('keeps the id case-sensitive', () => {
    expect(parseAssetReference('lc-asset://AbC')).toBe('AbC');
  });

  it('exposes the scheme it parses', () => {
    expect(ASSET_REFERENCE_SCHEME).toBe('lc-asset://');
  });
});
