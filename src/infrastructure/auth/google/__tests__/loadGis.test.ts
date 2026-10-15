import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadGisScript, resetGisScriptLoader, GIS_SCRIPT_URL, type GoogleGlobal } from '../loadGis';

describe('Infrastructure: loadGis', () => {
  beforeEach(() => {
    resetGisScriptLoader();
    delete (window as unknown as { google?: unknown }).google;
    document.head.innerHTML = '';
  });

  afterEach(() => {
    resetGisScriptLoader();
    delete (window as unknown as { google?: unknown }).google;
    document.head.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('resolves immediately if window.google.accounts.oauth2 is already loaded', async () => {
    const mockGoogle: GoogleGlobal = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(),
        },
      },
    };
    window.google = mockGoogle;

    const result = await loadGisScript();
    expect(result).toBe(mockGoogle);
    expect(document.querySelector('script')).toBeNull();
  });

  it('creates script element and resolves when script triggers load with google available', async () => {
    const loadPromise = loadGisScript();

    const script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    expect(script).not.toBeNull();
    expect(script?.async).toBe(true);
    expect(script?.defer).toBe(true);

    const mockGoogle: GoogleGlobal = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(),
        },
      },
    };
    window.google = mockGoogle;

    script?.dispatchEvent(new Event('load'));

    const result = await loadPromise;
    expect(result).toBe(mockGoogle);
  });

  it('reuses in-flight promise when called multiple times concurrently', async () => {
    const promise1 = loadGisScript();
    const promise2 = loadGisScript();

    expect(promise1).toBe(promise2);

    const scripts = document.querySelectorAll(`script[src="${GIS_SCRIPT_URL}"]`);
    expect(scripts.length).toBe(1);

    window.google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(),
        },
      },
    };

    scripts[0].dispatchEvent(new Event('load'));

    const [res1, res2] = await Promise.all([promise1, promise2]);
    expect(res1).toBe(window.google);
    expect(res2).toBe(window.google);
  });

  it('attaches to existing script tag if one is already present in document', async () => {
    const existingScript = document.createElement('script');
    existingScript.src = GIS_SCRIPT_URL;
    document.head.appendChild(existingScript);

    const loadPromise = loadGisScript();

    const allScripts = document.querySelectorAll(`script[src="${GIS_SCRIPT_URL}"]`);
    expect(allScripts.length).toBe(1);

    window.google = {
      accounts: {
        oauth2: {
          initCodeClient: vi.fn(),
        },
      },
    };

    existingScript.dispatchEvent(new Event('load'));
    const result = await loadPromise;
    expect(result).toBe(window.google);
  });

  it('rejects and cleans up script when script encounters a network error', async () => {
    const loadPromise = loadGisScript();

    const script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    expect(script).not.toBeNull();

    script?.dispatchEvent(new Event('error'));

    await expect(loadPromise).rejects.toThrow(/Failed to load Google Identity Services script/);
    expect(document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)).toBeNull();
  });

  it('rejects and cleans up script if script loads but google.accounts.oauth2 is missing', async () => {
    const loadPromise = loadGisScript();

    const script = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    expect(script).not.toBeNull();

    script?.dispatchEvent(new Event('load'));

    await expect(loadPromise).rejects.toThrow(/window\.google\.accounts\.oauth2 was not initialized/);
    expect(document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)).toBeNull();
  });
});
