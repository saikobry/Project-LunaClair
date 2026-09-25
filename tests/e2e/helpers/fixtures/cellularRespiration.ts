import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getE2EShareFixture } from '../../../../scripts/lib/e2eShareFixtures.mjs';
import type { ShareFixture } from '../share-seed';

/**
 * The canonical `cellular-respiration` share fixture used as the minimal
 * markdown-only notes material for writer, reader, and AI generator coverage,
 * and as the second imported material in unsaved-navigation coverage.
 *
 * The payload is generated from canonical content by `npm run generate:e2e-fixtures`;
 * this module only derives the share surface metadata from that payload.
 */
const here = dirname(fileURLToPath(import.meta.url));
const spec = getE2EShareFixture('cellularRespiration');

const payload = JSON.parse(readFileSync(resolve(here, spec.fixtureFile), 'utf8'));

export const cellularRespiration: ShareFixture = {
  shareId: spec.shareId,
  title: payload.metadata.title,
  description: payload.metadata.description,
  author: payload.metadata.author,
  createdAt: payload.metadata.createdAt,
  package: payload,
};
