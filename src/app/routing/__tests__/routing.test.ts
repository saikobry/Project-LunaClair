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

describe('material workspace routing', () => {
  it('serializes the workspace route with its tab', () => {
    expect(
      routeToUrl({ kind: 'workspace', workspace: 'material', materialId: 'm-1', activeTab: 'read' }),
    ).toBe('/materials/m-1?tab=read');
  });

  it('carries the collection origin into the URL as ?from=', () => {
    expect(
      routeToUrl({
        kind: 'workspace',
        workspace: 'material',
        materialId: 'm-1',
        activeTab: 'write',
        fromCollectionId: 'c-1',
      }),
    ).toBe('/materials/m-1?tab=write&from=c-1');
  });

  it('parses a workspace URL without an origin', () => {
    expect(urlToRoute('/materials/m-1', '?tab=quiz')).toEqual({
      kind: 'workspace',
      workspace: 'material',
      materialId: 'm-1',
      activeTab: 'quiz',
      fromCollectionId: undefined,
    });
  });

  it('parses the origin back out of ?from=', () => {
    expect(urlToRoute('/materials/m-1', '?from=c-1&tab=read')).toEqual({
      kind: 'workspace',
      workspace: 'material',
      materialId: 'm-1',
      activeTab: 'read',
      fromCollectionId: 'c-1',
    });
  });

  it('parses params regardless of order (only serialization fixes the order)', () => {
    expect(urlToRoute('/materials/m-1', '?from=c-1&tab=read')).toEqual({
      kind: 'workspace',
      workspace: 'material',
      materialId: 'm-1',
      activeTab: 'read',
      fromCollectionId: 'c-1',
    });
  });

  it('ignores an empty origin param', () => {
    expect(urlToRoute('/materials/m-1', '?from=')).toEqual({
      kind: 'workspace',
      workspace: 'material',
      materialId: 'm-1',
      activeTab: 'read',
      fromCollectionId: undefined,
    });
  });

  it('round-trips a workspace route through its URL', () => {
    const route = {
      kind: 'workspace',
      workspace: 'material',
      materialId: 'm-1',
      activeTab: 'flashcards',
      fromCollectionId: 'c-1',
    } as const;

    const url = routeToUrl(route);
    expect(urlToRoute(url.split('?')[0], `?${url.split('?')[1]}`)).toEqual(route);
  });
});

describe('home routing', () => {
  it('serializes a home route to /', () => {
    expect(routeToUrl({ kind: 'home' })).toBe('/');
  });

  it('parses / into a home route', () => {
    expect(urlToRoute('/', '')).toEqual({ kind: 'home' });
  });

  it('parses an empty path into a home route', () => {
    expect(urlToRoute('', '')).toEqual({ kind: 'home' });
  });
});

describe('library routing', () => {
  it('serializes a bare library route to /library', () => {
    expect(routeToUrl({ kind: 'library' })).toBe('/library');
  });

  it('omits the default membership filter from the URL', () => {
    expect(routeToUrl({ kind: 'library', filter: 'all' })).toBe('/library');
  });

  it('serializes a membership filter into the query string', () => {
    expect(routeToUrl({ kind: 'library', filter: 'uncollected' })).toBe('/library?filter=uncollected');
  });

  it('parses /library without a filter', () => {
    expect(urlToRoute('/library', '')).toEqual({ kind: 'library', filter: undefined });
  });

  it('parses /library?filter=collected', () => {
    expect(urlToRoute('/library', '?filter=collected')).toEqual({ kind: 'library', filter: 'collected' });
  });

  it('ignores an unknown filter value', () => {
    expect(urlToRoute('/library', '?filter=bogus')).toEqual({ kind: 'library', filter: undefined });
  });

  it('ignores retired filter slugs', () => {
    expect(urlToRoute('/library', '?filter=filed')).toEqual({ kind: 'library', filter: undefined });
    expect(urlToRoute('/library', '?filter=unfiled')).toEqual({ kind: 'library', filter: undefined });
  });
});

describe('library view routing', () => {
  it('omits the default overview view from the URL', () => {
    expect(routeToUrl({ kind: 'library', view: 'overview' })).toBe('/library');
    expect(routeToUrl({ kind: 'library', view: 'overview', filter: 'collected' })).toBe(
      '/library?filter=collected',
    );
  });

  it('serializes a non-default view into the query string', () => {
    expect(routeToUrl({ kind: 'library', view: 'collections' })).toBe('/library?view=collections');
    expect(routeToUrl({ kind: 'library', view: 'materials' })).toBe('/library?view=materials');
  });

  it('serializes filter and view together', () => {
    expect(routeToUrl({ kind: 'library', filter: 'uncollected', view: 'materials' })).toBe(
      '/library?filter=uncollected&view=materials',
    );
  });

  it('parses /library?view=collections', () => {
    expect(urlToRoute('/library', '?view=collections')).toEqual({
      kind: 'library',
      filter: undefined,
      view: 'collections',
    });
  });

  it('parses combined filter and view params', () => {
    expect(urlToRoute('/library', '?filter=collected&view=materials')).toEqual({
      kind: 'library',
      filter: 'collected',
      view: 'materials',
    });
  });

  it('ignores an unknown view value', () => {
    expect(urlToRoute('/library', '?view=bogus')).toEqual({ kind: 'library', filter: undefined });
  });
});
