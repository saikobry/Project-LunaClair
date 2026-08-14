#!/usr/bin/env node
/**
 * Standalone, zero-dependency Node.js seeder for the LunaClair library catalog.
 *
 * Reads `content/catalog/*.json` (subjects, terms, subjectTerms, materials) and
 * upserts the whole catalog to D1 via the `api` Worker's `PUT /api/catalog`
 * endpoint using the bearer `SEED_TOKEN`. Idempotent — safe to re-run.
 *
 * Usage:
 *   node scripts/seed-catalog.mjs --local
 *   node scripts/seed-catalog.mjs --remote
 *   node scripts/seed-catalog.mjs --base-url https://example.com --token mysecret
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const CATALOG_DIR = resolve(ROOT_DIR, 'content', 'catalog');

const CATALOG_FILES = ['subjects', 'terms', 'subjectTerms', 'materials'];

function parseArgs() {
  const args = process.argv.slice(2);
  let target = 'local';
  let customUrl = null;
  let customToken = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--remote') {
      target = 'remote';
    } else if (arg === '--local') {
      target = 'local';
    } else if (arg === '--base-url' && args[i + 1]) {
      customUrl = args[++i];
    } else if (arg === '--token' && args[i + 1]) {
      customToken = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: node scripts/seed-catalog.mjs [options]

Options:
  --local             Target local dev Worker (http://127.0.0.1:8787) [default]
  --remote            Target deployed production Worker (https://api.project-lunaclair.workers.dev)
  --base-url <url>    Specify custom Worker API base URL
  --token <token>     Specify SEED_TOKEN (defaults to .dev.vars or SEED_TOKEN env var)
  --help, -h          Show this help message
`);
      process.exit(0);
    }
  }

  return { target, customUrl, customToken };
}

function getSeedToken(customToken) {
  if (customToken) return customToken;
  if (process.env.SEED_TOKEN) return process.env.SEED_TOKEN.trim();

  const devVarsPath = resolve(ROOT_DIR, '.dev.vars');
  if (existsSync(devVarsPath)) {
    const content = readFileSync(devVarsPath, 'utf8');
    const match = content.match(/^SEED_TOKEN\s*=\s*(.+)$/m);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  throw new Error(
    'Missing SEED_TOKEN. Pass --token <token>, set SEED_TOKEN in environment, or define SEED_TOKEN in .dev.vars',
  );
}

function loadCatalog() {
  const catalog = {};
  for (const name of CATALOG_FILES) {
    const filePath = resolve(CATALOG_DIR, `${name}.json`);
    if (!existsSync(filePath)) {
      throw new Error(`Missing catalog file: ${filePath}`);
    }
    const rows = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(rows)) {
      throw new Error(`Catalog file must contain a JSON array: ${filePath}`);
    }
    catalog[name] = rows;
    console.log(`  📦 ${name}.json — ${rows.length} rows`);
  }
  return catalog;
}

async function seed() {
  const { target, customUrl, customToken } = parseArgs();
  const token = getSeedToken(customToken);

  let baseUrl = customUrl;
  if (!baseUrl) {
    baseUrl =
      target === 'remote'
        ? 'https://api.project-lunaclair.workers.dev'
        : 'http://127.0.0.1:8787';
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  console.log(`🌱 Seeding catalog to: ${baseUrl} (${target} mode)`);

  if (!existsSync(CATALOG_DIR)) {
    throw new Error(`Catalog directory not found: ${CATALOG_DIR}`);
  }

  const catalog = loadCatalog();

  const res = await fetch(`${baseUrl}/api/catalog`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(catalog),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Failed to PUT catalog (${res.status}): ${errText}`);
  }

  const result = await res.json();
  console.log(
    `✅ Catalog upserted: ${catalog.subjects.length} subjects, ${catalog.terms.length} terms, ` +
      `${catalog.subjectTerms.length} subject-terms, ${catalog.materials.length} materials ` +
      `(server stamped ${result.updatedAt})`,
  );
}

seed().catch((err) => {
  console.error('\n❌ Seeding failed:', err.message);
  process.exit(1);
});
