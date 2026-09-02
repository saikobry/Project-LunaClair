import { describe, it, expect } from 'vitest';
import { getOffsetsOfRange, restoreRange } from '../selection';

describe('selection utils', () => {
  describe('getOffsetsOfRange', () => {
    it('computes character offsets within a single text node container', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('Hello World LunaClair');
      container.appendChild(textNode);
      document.body.appendChild(container);

      const range = document.createRange();
      range.setStart(textNode, 6);
      range.setEnd(textNode, 11);

      const offsets = getOffsetsOfRange(range, container);
      expect(offsets).toEqual({ start: 6, end: 11 });

      document.body.removeChild(container);
    });

    it('computes character offsets across nested DOM elements', () => {
      const container = document.createElement('div');
      const p = document.createElement('p');
      const text1 = document.createTextNode('Start ');
      const strong = document.createElement('strong');
      const text2 = document.createTextNode('BoldText');
      strong.appendChild(text2);
      const text3 = document.createTextNode(' End');

      p.appendChild(text1);
      p.appendChild(strong);
      p.appendChild(text3);
      container.appendChild(p);
      document.body.appendChild(container);

      // Range from 'BoldText' (index 4) to ' End' (index 2)
      // 'Start ' (len 6) + 'Bold' (4) = 10 start offset
      // 'Start BoldText' (len 14) + ' E' (2) = 16 end offset
      const range = document.createRange();
      range.setStart(text2, 4);
      range.setEnd(text3, 2);

      const offsets = getOffsetsOfRange(range, container);
      expect(offsets).toEqual({ start: 10, end: 16 });

      document.body.removeChild(container);
    });

    it('returns null if start or end container is outside the provided container', () => {
      const container1 = document.createElement('div');
      const container2 = document.createElement('div');
      const textNode1 = document.createTextNode('Node in Container 1');
      const textNode2 = document.createTextNode('Node in Container 2');

      container1.appendChild(textNode1);
      container2.appendChild(textNode2);

      const range = document.createRange();
      range.setStart(textNode2, 0);
      range.setEnd(textNode2, 4);

      const offsets = getOffsetsOfRange(range, container1);
      expect(offsets).toBeNull();
    });
  });

  describe('restoreRange', () => {
    it('restores a DOM Range from character offsets in a single text node', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('Hello World LunaClair');
      container.appendChild(textNode);
      document.body.appendChild(container);

      const restoredRange = restoreRange(container, 6, 11);
      expect(restoredRange).not.toBeNull();
      expect(restoredRange?.startContainer).toBe(textNode);
      expect(restoredRange?.startOffset).toBe(6);
      expect(restoredRange?.endContainer).toBe(textNode);
      expect(restoredRange?.endOffset).toBe(11);
      expect(restoredRange?.toString()).toBe('World');

      document.body.removeChild(container);
    });

    it('restores a DOM Range across nested child nodes', () => {
      const container = document.createElement('div');
      const p = document.createElement('p');
      const text1 = document.createTextNode('Start ');
      const strong = document.createElement('strong');
      const text2 = document.createTextNode('BoldText');
      strong.appendChild(text2);
      const text3 = document.createTextNode(' End');

      p.appendChild(text1);
      p.appendChild(strong);
      p.appendChild(text3);
      container.appendChild(p);
      document.body.appendChild(container);

      // Offset 10 ('Text') to 16 (' E')
      const restoredRange = restoreRange(container, 10, 16);
      expect(restoredRange).not.toBeNull();
      expect(restoredRange?.startContainer).toBe(text2);
      expect(restoredRange?.startOffset).toBe(4);
      expect(restoredRange?.endContainer).toBe(text3);
      expect(restoredRange?.endOffset).toBe(2);
      expect(restoredRange?.toString()).toBe('Text E');

      document.body.removeChild(container);
    });

    it('returns null if requested offsets are beyond the total text length', () => {
      const container = document.createElement('div');
      const textNode = document.createTextNode('Short');
      container.appendChild(textNode);

      const restoredRange = restoreRange(container, 10, 20);
      expect(restoredRange).toBeNull();
    });
  });
});
