#!/usr/bin/env node
/**
 * Standalone, zero-dependency Node.js seeder for LunaClair study materials.
 *
 * Walks `content/materials/**`, extracts titles and content from `index.md`,
 * detects figures in `images/`, and idempotently upserts them to D1 via the
 * `api` Worker PUT endpoints using the bearer `SEED_TOKEN`.
 *
 * Usage:
 *   node scripts/seed-materials.mjs --local
 *   node scripts/seed-materials.mjs --remote
 *   node scripts/seed-materials.mjs --base-url https://example.com --token mysecret
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const MATERIALS_DIR = resolve(ROOT_DIR, 'content', 'materials');

const MIME_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

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
Usage: node scripts/seed-materials.mjs [options]

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

function extractTitle(content, fallback) {
  const match = content.match(/^#\s+(.+)$/m);
  if (match && match[1]) {
    return match[1].trim();
  }
  return fallback;
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

  console.log(`🌱 Seeding materials to: ${baseUrl} (${target} mode)`);

  if (!existsSync(MATERIALS_DIR)) {
    throw new Error(`Materials directory not found: ${MATERIALS_DIR}`);
  }

  const entries = readdirSync(MATERIALS_DIR);
  const materialDirs = entries.filter((name) =>
    statSync(join(MATERIALS_DIR, name)).isDirectory(),
  );

  console.log(`Found ${materialDirs.length} study material folders.`);

  let totalDocs = 0;
  let totalFigures = 0;

  for (const sourceId of materialDirs) {
    const dirPath = join(MATERIALS_DIR, sourceId);
    const mdPath = join(dirPath, 'index.md');

    if (!existsSync(mdPath)) {
      console.warn(`⚠️ Skipping ${sourceId}: missing index.md`);
      continue;
    }

    const content = readFileSync(mdPath, 'utf8');
    const title = extractTitle(content, sourceId);

    // 1. PUT Document
    const docUrl = `${baseUrl}/api/documents/${encodeURIComponent(sourceId)}`;
    const docRes = await fetch(docUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title, content }),
    });

    if (!docRes.ok) {
      const errText = await docRes.text();
      throw new Error(`Failed to PUT document ${sourceId} (${docRes.status}): ${errText}`);
    }

    totalDocs++;
    console.log(`  📄 [Doc] ${sourceId} — "${title}" (${content.length} chars)`);

    // 2. PUT Figures if images/ exists
    const imagesDir = join(dirPath, 'images');
    if (existsSync(imagesDir) && statSync(imagesDir).isDirectory()) {
      const figureFiles = readdirSync(imagesDir).filter((file) =>
        statSync(join(imagesDir, file)).isFile(),
      );

      for (const filename of figureFiles) {
        const figPath = join(imagesDir, filename);
        const buffer = readFileSync(figPath);
        const ext = extname(filename).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        const figUrl = `${baseUrl}/api/documents/${encodeURIComponent(sourceId)}/figures/${encodeURIComponent(filename)}`;
        const figRes = await fetch(figUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            Authorization: `Bearer ${token}`,
          },
          body: buffer,
        });

        if (!figRes.ok) {
          const errText = await figRes.text();
          throw new Error(
            `Failed to PUT figure ${sourceId}/${filename} (${figRes.status}): ${errText}`,
          );
        }

        totalFigures++;
        console.log(`    🖼️  [Figure] ${filename} (${buffer.length} bytes, ${contentType})`);
      }
    }
  }

  console.log(`\n✅ Seeding complete: ${totalDocs} documents, ${totalFigures} figures upserted.`);
}

seed().catch((err) => {
  console.error('\n❌ Seeding failed:', err.message);
  process.exit(1);
});
