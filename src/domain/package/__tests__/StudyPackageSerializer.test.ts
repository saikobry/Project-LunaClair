import { describe, it, expect } from 'vitest';
import type { StudyPackage } from '../package.types';
import {
  serializePackageToJson,
  serializePackageToBlob,
  blobToBase64,
  base64ToBlob,
  arrayBufferToBase64,
  base64ToUint8Array,
  PACKAGE_MIME_TYPE,
  PACKAGE_JSON_MIME_TYPE,
  LUNACLAIR_PACKAGE_MIME_TYPE,
} from '../StudyPackageSerializer';

describe('StudyPackageSerializer', () => {
  const samplePackage: StudyPackage = {
    format: 'lcpack',
    schemaVersion: 1,
    metadata: {
      title: 'Biology 101 Study Set',
      description: 'Cellular respiration and genetics',
      author: 'Jane Doe',
      createdAt: '2026-08-27T10:00:00.000Z',
      appVersion: '1.0.0',
      tags: ['biology', 'cells'],
    },
    materials: [
      {
        id: 'pkg_mat_1',
        title: 'Cellular Respiration',
        description: 'Chapter 5 summary',
        documentContent: '# Cellular Respiration\n\n![Mitochondria](lc-asset://pkg_asset_1)',
        order: 1,
      },
    ],
    questions: [
      {
        id: 'pkg_q_1',
        materialId: 'pkg_mat_1',
        type: 'multiple_choice',
        prompt: 'Where does glycolysis occur?',
        payload: {
          type: 'multiple_choice',
          choices: ['Cytoplasm', 'Mitochondria'],
          correctIndex: 0,
        },
        difficulty: 'easy',
        points: 1,
        explanation: 'Glycolysis occurs in the cytoplasm.',
        tags: ['glycolysis'],
      },
    ],
    quizzes: [
      {
        id: 'pkg_quiz_1',
        materialId: 'pkg_mat_1',
        title: 'Cellular Respiration Quiz',
        items: [
          {
            questionId: 'pkg_q_1',
            order: 1,
            points: 1,
          },
        ],
      },
    ],
    flashcards: [
      {
        id: 'pkg_card_1',
        materialId: 'pkg_mat_1',
        front: 'What is ATP?',
        back: 'Adenosine Triphosphate, energy currency of the cell.',
      },
    ],
    assets: [
      {
        id: 'pkg_asset_1',
        filename: 'mitochondria.png',
        mimeType: 'image/png',
        dataBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    ],
  };

  describe('serializePackageToJson', () => {
    it('serializes package to compact JSON by default', () => {
      const json = serializePackageToJson(samplePackage);
      expect(typeof json).toBe('string');
      expect(json).not.toContain('\n');
      expect(JSON.parse(json)).toEqual(samplePackage);
    });

    it('serializes package with pretty formatting when pretty is true', () => {
      const json = serializePackageToJson(samplePackage, true);
      expect(typeof json).toBe('string');
      expect(json).toContain('\n  "format": "lcpack"');
      expect(JSON.parse(json)).toEqual(samplePackage);
    });

    it('serializes package compactly when pretty is false explicitly', () => {
      const json = serializePackageToJson(samplePackage, false);
      expect(typeof json).toBe('string');
      expect(json).not.toContain('\n');
      expect(JSON.parse(json)).toEqual(samplePackage);
    });
  });

  describe('serializePackageToBlob', () => {
    it('creates a Blob with default package MIME type', async () => {
      const blob = serializePackageToBlob(samplePackage);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe(PACKAGE_MIME_TYPE);
      expect(blob.type).toBe(LUNACLAIR_PACKAGE_MIME_TYPE);

      const text = await blob.text();
      expect(JSON.parse(text)).toEqual(samplePackage);
    });

    it('creates a Blob with custom MIME type when specified', async () => {
      const blob = serializePackageToBlob(samplePackage, PACKAGE_JSON_MIME_TYPE);
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe(PACKAGE_JSON_MIME_TYPE);

      const text = await blob.text();
      expect(JSON.parse(text)).toEqual(samplePackage);
    });

    it('supports pretty boolean flag as second argument', async () => {
      const blob = serializePackageToBlob(samplePackage, true);
      expect(blob.type).toBe(PACKAGE_MIME_TYPE);
      const text = await blob.text();
      expect(text).toContain('\n  "format": "lcpack"');
    });
  });

  describe('Base64 and ArrayBuffer conversion utilities', () => {
    it('encodes and decodes an empty Blob', async () => {
      const emptyBlob = new Blob([], { type: 'application/octet-stream' });
      const base64 = await blobToBase64(emptyBlob);
      expect(base64).toBe('');

      const recoveredBlob = base64ToBlob(base64, 'application/octet-stream');
      expect(recoveredBlob.size).toBe(0);
      expect(recoveredBlob.type).toBe('application/octet-stream');
    });

    it('encodes and decodes binary data across all byte values (0-255)', async () => {
      const rawBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        rawBytes[i] = i;
      }

      const originalBlob = new Blob([rawBytes], { type: 'image/png' });
      const base64 = await blobToBase64(originalBlob);
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);

      const decodedBlob = base64ToBlob(base64, 'image/png');
      expect(decodedBlob.type).toBe('image/png');
      expect(decodedBlob.size).toBe(256);

      const decodedBuffer = await decodedBlob.arrayBuffer();
      const decodedBytes = new Uint8Array(decodedBuffer);
      expect(decodedBytes).toEqual(rawBytes);
    });

    it('encodes large binary assets exceeding single chunk size (32KB+)', async () => {
      const size = 70000;
      const largeBytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        largeBytes[i] = (i * 37) % 256;
      }

      const originalBlob = new Blob([largeBytes], { type: 'application/pdf' });
      const base64 = await blobToBase64(originalBlob);
      const decodedBlob = base64ToBlob(base64, 'application/pdf');

      expect(decodedBlob.size).toBe(size);
      const decodedBytes = new Uint8Array(await decodedBlob.arrayBuffer());
      expect(decodedBytes).toEqual(largeBytes);
    });

    it('handles data URL prefix in base64ToBlob gracefully', async () => {
      const originalBytes = new Uint8Array([10, 20, 30, 40]);
      const rawBlob = new Blob([originalBytes], { type: 'image/jpeg' });
      const rawBase64 = await blobToBase64(rawBlob);

      const dataUrl = `data:image/jpeg;base64,${rawBase64}`;
      const decodedBlob = base64ToBlob(dataUrl, 'image/jpeg');

      expect(decodedBlob.size).toBe(4);
      const decodedBytes = new Uint8Array(await decodedBlob.arrayBuffer());
      expect(decodedBytes).toEqual(originalBytes);
    });

    it('converts ArrayBuffer to Base64 and back to Uint8Array', () => {
      const originalBytes = new Uint8Array([1, 2, 3, 4, 5, 255]);
      const base64 = arrayBufferToBase64(originalBytes.buffer as ArrayBuffer);
      const uint8 = base64ToUint8Array(base64);

      expect(Array.from(uint8)).toEqual([1, 2, 3, 4, 5, 255]);
    });
  });
});
