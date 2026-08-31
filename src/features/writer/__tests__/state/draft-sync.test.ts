import { describe, it, expect } from 'vitest';
import { normalizeMarkdown } from '../../utils/markdownNormalizer';

describe('Writer Draft State & Observable Synchronization', () => {
  describe('Conservative Dirty State Invariants', () => {
    it('detects pristine state when draft is identical to saved document', () => {
      const saved = '# My Notes\n\nStudy content.';
      const draft = '# My Notes\n\nStudy content.';
      const isDirty = normalizeMarkdown(draft) !== normalizeMarkdown(saved);
      expect(isDirty).toBe(false);
    });

    it('detects dirty state when meaningful content changes occur', () => {
      const saved = '# My Notes\n\nStudy content.';
      const draft = '# My Notes\n\nUpdated study content with new findings.';
      const isDirty = normalizeMarkdown(draft) !== normalizeMarkdown(saved);
      expect(isDirty).toBe(true);
    });

    it('treats cosmetic representations (such as trailing newlines or table padding) as clean', () => {
      const saved = '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |';
      const draft = '|Header 1|Header 2|\n|---|---|\n|Cell 1|Cell 2|\n\n';
      const isDirty = normalizeMarkdown(draft) !== normalizeMarkdown(saved);
      expect(isDirty).toBe(false);
    });

    it('treats block separation normalization (single vs double newline) as clean', () => {
      const saved = '### Functions\n- Item 1\n- Item 2';
      const draft = '### Functions\n\n- Item 1\n- Item 2';
      const isDirty = normalizeMarkdown(draft) !== normalizeMarkdown(saved);
      expect(isDirty).toBe(false);
    });

    it('treats code block internal whitespace and indentation changes as dirty', () => {
      const saved = '```ts\nconst x = 1;\n```';
      const draft = '```ts\n  const x = 1;\n```';
      const isDirty = normalizeMarkdown(draft) !== normalizeMarkdown(saved);
      expect(isDirty).toBe(true);
    });

    it('treats list indentation changes (nesting alterations) as dirty', () => {
      const saved = '- Parent item\n  - Child item';
      const draft = '- Parent item\n- Child item';
      const isDirty = normalizeMarkdown(draft) !== normalizeMarkdown(saved);
      expect(isDirty).toBe(true);
    });
  });

  describe('Observable Mode-Switching & Discard Lifecycles', () => {
    interface EditorStateModel {
      savedMarkdown: string;
      draftMarkdown: string;
      isRawMode: boolean;
      editorVersion: number;
    }

    function createTestState(initialContent: string): EditorStateModel {
      return {
        savedMarkdown: initialContent,
        draftMarkdown: initialContent,
        isRawMode: false,
        editorVersion: 0,
      };
    }

    function typeInVisual(state: EditorStateModel, newMarkdown: string): EditorStateModel {
      // Visual mode emits markdown onChange -> updates draft without remounting
      return {
        ...state,
        draftMarkdown: newMarkdown,
      };
    }

    function typeInRaw(state: EditorStateModel, newMarkdown: string): EditorStateModel {
      // Raw mode directly updates draft
      return {
        ...state,
        draftMarkdown: newMarkdown,
      };
    }

    function toggleMode(state: EditorStateModel): EditorStateModel {
      const nextMode = !state.isRawMode;
      return {
        ...state,
        isRawMode: nextMode,
        // Entering visual mode re-initializes visual editor from current draft
        editorVersion: !nextMode ? state.editorVersion + 1 : state.editorVersion,
      };
    }

    function discard(state: EditorStateModel): EditorStateModel {
      return {
        ...state,
        draftMarkdown: state.savedMarkdown,
        editorVersion: state.editorVersion + 1,
      };
    }

    function receiveExternalUpdate(state: EditorStateModel, newSaved: string): EditorStateModel {
      const isDirty = normalizeMarkdown(state.draftMarkdown) !== normalizeMarkdown(state.savedMarkdown);
      if (!isDirty) {
        return {
          ...state,
          savedMarkdown: newSaved,
          draftMarkdown: newSaved,
          editorVersion: state.editorVersion + 1,
        };
      }
      // If dirty, do NOT silently overwrite user draft
      return {
        ...state,
        savedMarkdown: newSaved,
      };
    }

    it('preserves visual edits when switching to raw mode and back', () => {
      let state = createTestState('# Original');
      state = typeInVisual(state, '# Original\n\nVisual edit content.');
      expect(state.draftMarkdown).toBe('# Original\n\nVisual edit content.');

      // Switch to Raw mode
      state = toggleMode(state);
      expect(state.isRawMode).toBe(true);
      expect(state.draftMarkdown).toBe('# Original\n\nVisual edit content.');

      // Switch back to Visual mode
      state = toggleMode(state);
      expect(state.isRawMode).toBe(false);
      expect(state.draftMarkdown).toBe('# Original\n\nVisual edit content.');
    });

    it('preserves raw edits when switching to visual mode and back', () => {
      let state = createTestState('# Original');
      state = toggleMode(state); // Go to raw
      state = typeInRaw(state, '# Original\n\nRaw mode new paragraph.');

      // Switch to Visual mode
      state = toggleMode(state);
      expect(state.isRawMode).toBe(false);
      expect(state.draftMarkdown).toBe('# Original\n\nRaw mode new paragraph.');
    });

    it('restores saved document on discard from Visual mode', () => {
      let state = createTestState('# Saved Document');
      state = typeInVisual(state, '# Unsaved Modification');
      expect(normalizeMarkdown(state.draftMarkdown) !== normalizeMarkdown(state.savedMarkdown)).toBe(true);

      state = discard(state);
      expect(state.draftMarkdown).toBe('# Saved Document');
      expect(normalizeMarkdown(state.draftMarkdown) !== normalizeMarkdown(state.savedMarkdown)).toBe(false);
    });

    it('restores saved document on discard from Raw mode', () => {
      let state = createTestState('# Saved Document');
      state = toggleMode(state); // Go to raw
      state = typeInRaw(state, '# Raw Edits to Discard');

      state = discard(state);
      expect(state.draftMarkdown).toBe('# Saved Document');

      state = toggleMode(state); // Back to visual
      expect(state.draftMarkdown).toBe('# Saved Document');
    });

    it('updates draft on external document change when clean', () => {
      let state = createTestState('# Version 1');
      state = receiveExternalUpdate(state, '# Version 2 (Cloud Sync)');
      expect(state.savedMarkdown).toBe('# Version 2 (Cloud Sync)');
      expect(state.draftMarkdown).toBe('# Version 2 (Cloud Sync)');
    });

    it('protects dirty draft from silent overwrite when external document changes', () => {
      let state = createTestState('# Version 1');
      state = typeInVisual(state, '# Version 1 with local unsaved changes');
      state = receiveExternalUpdate(state, '# Version 2 (External conflict)');

      // User's unsaved draft is preserved!
      expect(state.draftMarkdown).toBe('# Version 1 with local unsaved changes');
      expect(state.savedMarkdown).toBe('# Version 2 (External conflict)');
    });

    it('manages SaveStatus state transitions through dirty, saving, error, and retry cycles', () => {
      // 1. Initial pristine state -> 'saved'
      let isDirty = false;
      let isPending = false;
      let isError = false;

      function deriveStatus() {
        if (isPending) return 'saving';
        if (isError) return 'error';
        if (isDirty) return 'unsaved';
        return 'saved';
      }

      expect(deriveStatus()).toBe('saved');

      // 2. User edits -> 'unsaved'
      isDirty = true;
      expect(deriveStatus()).toBe('unsaved');

      // 3. User saves -> 'saving'
      isPending = true;
      expect(deriveStatus()).toBe('saving');

      // 4. Save fails -> 'error' (draft is retained)
      isPending = false;
      isError = true;
      expect(deriveStatus()).toBe('error');

      // 5. User clicks Retry with current draft -> 'saving'
      isPending = true;
      isError = false;
      expect(deriveStatus()).toBe('saving');

      // 6. Save succeeds -> 'saved'
      isPending = false;
      isDirty = false;
      expect(deriveStatus()).toBe('saved');
    });

    it('hydrates draft correctly on page reload when document loads asynchronously', () => {
      // Simulates mounting when doc is undefined, then resolving to persisted content
      let hasHydrated = false;
      let lastSavedMarkdown: string | null = null;
      let draftMarkdown = '';
      let editorKey = 0;

      function onDocLoaded(content: string) {
        if (!hasHydrated) {
          hasHydrated = true;
          lastSavedMarkdown = content;
          draftMarkdown = content;
          editorKey++;
        }
      }

      // Initial state before query resolution
      expect(draftMarkdown).toBe('');
      expect(hasHydrated).toBe(false);

      // Async query resolves with persisted content
      onDocLoaded('# Persisted Biological Notes\n\nContent survives reload.');

      expect(hasHydrated).toBe(true);
      expect(draftMarkdown).toBe('# Persisted Biological Notes\n\nContent survives reload.');
      expect(lastSavedMarkdown).toBe('# Persisted Biological Notes\n\nContent survives reload.');
      expect(editorKey).toBe(1);

      // Dirty check against loaded content evaluates to false (clean state)
      const isDirty = normalizeMarkdown(draftMarkdown) !== normalizeMarkdown(lastSavedMarkdown!);
      expect(isDirty).toBe(false);
    });
  });
});
