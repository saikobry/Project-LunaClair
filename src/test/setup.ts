import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Polyfill StyleX for Vitest / JSDOM environment
vi.mock('@stylexjs/stylex', () => {
  const mockStylex = {
    create: (styles: Record<string, unknown>) => styles,
    props: (...styles: unknown[]) => ({
      className: styles
        .filter(Boolean)
        .map((s) => (typeof s === 'string' ? s : JSON.stringify(s)))
        .join(' '),
    }),
    keyframes: (_frames: Record<string, unknown>) => 'mock-keyframes',
    defineVars: (vars: Record<string, unknown>) => vars,
    createTheme: (_theme: unknown, vars: Record<string, unknown>) => vars,
  };
  return {
    default: mockStylex,
    ...mockStylex,
  };
});

// Polyfill window.matchMedia for JSDOM
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Polyfill ResizeObserver for JSDOM
if (typeof globalThis.ResizeObserver === 'undefined') {
  class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = MockResizeObserver as any;
}

// Polyfill HTMLDialogElement showModal/close for JSDOM
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.open = false;
  };
}

// Polyfill localStorage for Node.js 26 / JSDOM environment
const storageStore = new Map<string, string>();
const localStorageMock: Storage = {
  getItem: (key: string) => storageStore.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storageStore.set(key, String(value));
  },
  removeItem: (key: string) => {
    storageStore.delete(key);
  },
  clear: () => {
    storageStore.clear();
  },
  key: (index: number) => Array.from(storageStore.keys())[index] ?? null,
  get length() {
    return storageStore.size;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
    configurable: true,
  });
}

// Automatically clean up DOM after each test
afterEach(() => {
  cleanup();
});
