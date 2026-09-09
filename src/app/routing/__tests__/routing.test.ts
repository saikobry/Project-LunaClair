import { describe, it, expect } from 'vitest';
import { routeToUrl, urlToRoute } from '../routing';

describe('collection routing', () => {
  it('serializes a collection route to /collections/:collectionId', () => {
    expect(routeToUrl({ kind: 'collection', collectionId: 'c-1' })).toBe('/collections/c-1');
  });

  it('parses /collections/:collectionId into a collection route', () => {
    expect(urlToRoute('/collections/c-1', '')).toEqual({ kind: 'collection', collectionId: 'c-1' });
  });
});
