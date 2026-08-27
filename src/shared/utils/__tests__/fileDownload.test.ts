import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sanitizeFilename, triggerBlobDownload } from '../fileDownload';

describe('fileDownload utilities', () => {
  describe('sanitizeFilename', () => {
    it('returns the input name when it contains only valid characters', () => {
      expect(sanitizeFilename('Physics Chapter 1')).toBe('Physics Chapter 1');
      expect(sanitizeFilename('notes-2026_final')).toBe('notes-2026_final');
    });

    it('replaces illegal filesystem characters with underscores', () => {
      expect(sanitizeFilename('Biology: Cell Structure <v1>')).toBe('Biology_ Cell Structure _v1_');
      expect(sanitizeFilename('A/B\\C|D?E*F"G')).toBe('A_B_C_D_E_F_G');
    });

    it('strips control characters', () => {
      expect(sanitizeFilename('Hello\x00World\x1F')).toBe('Hello_World_');
    });

    it('trims leading and trailing spaces and trailing dots', () => {
      expect(sanitizeFilename('  My Notes...  ')).toBe('My Notes');
      expect(sanitizeFilename('Chapter 1.2.')).toBe('Chapter 1.2');
    });

    it('returns default fallback for empty or whitespace-only inputs', () => {
      expect(sanitizeFilename('')).toBe('study-package');
      expect(sanitizeFilename('   ')).toBe('study-package');
      expect(sanitizeFilename('...')).toBe('study-package');
      expect(sanitizeFilename(null as unknown as string)).toBe('study-package');
      expect(sanitizeFilename(undefined as unknown as string)).toBe('study-package');
    });

    it('returns custom fallback when specified', () => {
      expect(sanitizeFilename('', 'custom-fallback')).toBe('custom-fallback');
      expect(sanitizeFilename('   ', 'backup-name')).toBe('backup-name');
    });
  });

  describe('triggerBlobDownload', () => {
    let originalCreateObjectURL: typeof URL.createObjectURL;
    let originalRevokeObjectURL: typeof URL.revokeObjectURL;

    beforeEach(() => {
      originalCreateObjectURL = URL.createObjectURL;
      originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:http://localhost:3000/mock-uuid');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
      vi.restoreAllMocks();
    });

    it('creates object URL, appends anchor, triggers click, removes anchor, and revokes URL', () => {
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
      const appendSpy = vi.spyOn(document.body, 'appendChild');
      const removeSpy = vi.spyOn(document.body, 'removeChild');

      const blob = new Blob(['sample package content'], { type: 'application/json' });
      triggerBlobDownload(blob, 'sample.lcpack');

      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(appendSpy).toHaveBeenCalledTimes(1);
      const anchorElement = appendSpy.mock.calls[0][0] as HTMLAnchorElement;
      expect(anchorElement.tagName).toBe('A');
      expect(anchorElement.href).toBe('blob:http://localhost:3000/mock-uuid');
      expect(anchorElement.download).toBe('sample.lcpack');
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(removeSpy).toHaveBeenCalledWith(anchorElement);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost:3000/mock-uuid');
    });
  });
});
