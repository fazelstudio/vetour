#!/usr/bin/env bun
/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  publish-sdk.ts
 *  Publishes the SDK under two names from one source.
 *-----------------------------------------------------------------------------------------------*/

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_DIR = join(__dirname, '..', 'packages', 'vetour-sdk');
const PKG_FILE = join(PKG_DIR, 'package.json');
const NPM_REGISTRY = 'https://registry.npmjs.org/';
const GITHUB_REGISTRY = 'https://npm.pkg.github.com/';
const GITHUB_NAME = '@fazelstudio/vetour-sdk';

const args = new Set(process.argv.slice(2));
const withGithub = args.has('--github');
const dryRun = args.has('--dry-run');
const tagArg = [...args].find((item) => item.startsWith('--tag='));
const tag = tagArg ? tagArg.slice('--tag='.length) : 'latest';

async function runPublish(cwd: string, registry: string, label: string): Promise<void> {
  const publishArgs = ['publish', '--registry', registry, '--access', 'public', '--tag', tag];
  if (dryRun) publishArgs.push('--dry-run');
  console.log(`[sdk] Publishing ${label} to ${registry}${dryRun ? ' (dry run)' : ''}...`);
  const { spawnSync } = await import('child_process');
  const result = spawnSync('bun', publishArgs, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Publish failed for ${label}. Authenticate first, then retry.`);
  }
  console.log(`[sdk] Published ${label}.`);
}

const original = readFileSync(PKG_FILE, 'utf8');
const manifest = JSON.parse(original) as { name?: string };
if (manifest.name !== 'vetour-sdk') {
  throw new Error(`Expected package name "vetour-sdk", found "${manifest.name ?? 'none'}".`);
}

try {
  await runPublish(PKG_DIR, NPM_REGISTRY, 'vetour-sdk');
  if (withGithub) {
    // GitHub Packages requires the owner scope, so rename only for this publish.
    writeFileSync(PKG_FILE, JSON.stringify({ ...manifest, name: GITHUB_NAME }, null, 2) + '\n');
    await runPublish(PKG_DIR, GITHUB_REGISTRY, GITHUB_NAME);
  }
} finally {
  // Always restore the canonical unscoped name, even when publishing fails.
  writeFileSync(PKG_FILE, original.endsWith('\n') ? original : original + '\n');
}
