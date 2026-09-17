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

describe('explore routing', () => {
  it('serializes the default explore view to a bare /explore', () => {
    expect(routeToUrl({ kind: 'explore' })).toBe('/explore');
    expect(routeToUrl({ kind: 'explore', sort: 'popular' })).toBe('/explore');
    expect(routeToUrl({ kind: 'explore', sort: 'popular', q: '   ' })).toBe('/explore');
  });

  it('serializes a query and a non-default sort', () => {
    expect(routeToUrl({ kind: 'explore', q: 'retrosynthesis' })).toBe(
      '/explore?q=retrosynthesis',
    );
    expect(routeToUrl({ kind: 'explore', q: 'biology', sort: 'recent' })).toBe(
      '/explore?q=biology&sort=recent',
    );
  });

  it('parses q and sort from the URL', () => {
    expect(urlToRoute('/explore', '?q=biology&sort=recent')).toEqual({
      kind: 'explore',
      q: 'biology',
      sort: 'recent',
    });
  });

  it('ignores an unknown sort and a blank query', () => {
    expect(urlToRoute('/explore', '?q=%20&sort=bogus')).toEqual({
      kind: 'explore',
      q: undefined,
      sort: undefined,
    });
  });

  it('round-trips an explore route through its URL', () => {
    const route = { kind: 'explore', q: 'cell biology', sort: 'recent' } as const;

    const url = routeToUrl(route);
    expect(urlToRoute(url.split('?')[0], `?${url.split('?')[1]}`)).toEqual(route);
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

describe('share routing', () => {
  it('serializes a bare share route to /share/:shareId', () => {
    expect(routeToUrl({ kind: 'share', shareId: 's-1' })).toBe('/share/s-1');
  });

  it('carries the origin route into the URL as ?from=', () => {
    expect(routeToUrl({ kind: 'share', shareId: 's-1', from: { kind: 'explore' } })).toBe(
      '/share/s-1?from=%2Fexplore',
    );
  });

  it('carries the origin view state, not just its name', () => {
    // The hub's filters ARE the view, so the origin has to survive with them.
    expect(
      routeToUrl({
        kind: 'share',
        shareId: 's-1',
        from: { kind: 'explore', q: 'biology', sort: 'recent' },
      }),
    ).toBe('/share/s-1?from=%2Fexplore%3Fq%3Dbiology%26sort%3Drecent');
  });

  it('parses a share URL without an origin', () => {
    expect(urlToRoute('/share/s-1', '')).toEqual({ kind: 'share', shareId: 's-1', from: undefined });
  });

  it('parses the origin route back out of ?from=', () => {
    expect(urlToRoute('/share/s-1', '?from=%2Fexplore')).toEqual({
      kind: 'share',
      shareId: 's-1',
      from: { kind: 'explore', q: undefined, sort: undefined },
    });
  });

  it('parses the origin on the short /s/:code link too', () => {
    expect(urlToRoute('/s/abc123', '?from=%2Fexplore%3Fq%3Dbiology')).toEqual({
      kind: 'share',
      shareId: 'abc123',
      from: { kind: 'explore', q: 'biology', sort: undefined },
    });
  });

  it('ignores an origin that is not the Explore hub', () => {
    // A deep link must not be able to hand the share landing an arbitrary
    // "back" destination.
    expect(urlToRoute('/share/s-1', '?from=%2Flibrary')).toEqual({
      kind: 'share',
      shareId: 's-1',
      from: undefined,
    });
    expect(urlToRoute('/share/s-1', '?from=bogus')).toEqual({
      kind: 'share',
      shareId: 's-1',
      from: undefined,
    });
  });

  it('round-trips a share route through its URL with its filters intact', () => {
    const route = {
      kind: 'share',
      shareId: 's-1',
      from: { kind: 'explore', q: 'biology', sort: 'recent' },
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
