import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getE2EShareFixture } from '../../../../scripts/lib/e2eShareFixtures.mjs';
import type { ShareFixture } from '../share-seed';

/**
 * The canonical `cell-structure` share fixture.
 *
 * The payload is **generated, not authored** — `npm run generate:e2e-fixtures`
 * writes `cell-structure.lcpack.json` from canonical content via the shared pure
 * builder, and `src/__tests__/e2eFixtures/` fails if it ever drifts. Nothing here
 * restates a fact the payload already carries: the share id comes from the
 * fixture spec and the displayed metadata comes from the payload itself, so there
 * is only one place to update.
 *
 * Carries the full published graph (52 questions, both quizzes), so specs that
 * assert quiz/question relationships exercise the real material → question → quiz
 * import path rather than a hand-made stand-in.
 */
const here = dirname(fileURLToPath(import.meta.url));
const spec = getE2EShareFixture('cellStructure');

const payload = JSON.parse(readFileSync(resolve(here, spec.fixtureFile), 'utf8'));

export const cellStructure: ShareFixture = {
  shareId: spec.shareId,
  title: payload.metadata.title,
  description: payload.metadata.description,
  author: payload.metadata.author,
  createdAt: payload.metadata.createdAt,
  package: payload,
};
