/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  pluginPackage.ts
 *  Reader, writer, and gatekeeper for the versioned .veix plugin file format.
 *-----------------------------------------------------------------------------------------------*/

import { gzip, ungzip } from 'pako';

/* Binary layout: magic "VEIX" + u32LE format version + u32LE json length + gzip manifest. */
const PLUGIN_MAGIC = new Uint8Array([0x56, 0x45, 0x49, 0x58]);
const PLUGIN_FORMAT_VERSION = 1;

/*
Publishers accepted by the future plugin installer.
Full cryptographic signatures are planned later; the allowlist already
guarantees that only official packages pass the gate today.
*/
export const TRUSTED_PLUGIN_PUBLISHERS: readonly string[] = ['fazelstudio'];

export interface PluginManifest {
  // The legacy Vetour marker is still accepted when reading, but new files use Obsipano.
  kind: 'obsipano-extension' | 'vetour-extension';
  id: string;
  name: string;
  version: string;
  publisher: string;
  description?: string;
  license?: string;
  entry?: string;
  capabilities?: string[];
}

export type PluginValidationCode =
  | 'bad-magic'
  | 'truncated'
  | 'unsupported-version'
  | 'bad-manifest'
  | 'untrusted-publisher';

export class PluginPackageError extends Error {
  code: PluginValidationCode;

  constructor(code: PluginValidationCode, message: string) {
    super(message);
    this.name = 'PluginPackageError';
    this.code = code;
  }
}

function writeU32(value: number): Uint8Array {
  const buffer = new ArrayBuffer(4);
  new DataView(buffer).setUint32(0, value, true);
  return new Uint8Array(buffer);
}

function readU32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
}

// Check whether a publisher is allowed through the official-only gate.
export function isTrustedPublisher(publisher: string): boolean {
  return TRUSTED_PLUGIN_PUBLISHERS.includes(publisher);
}

// Serialize a manifest into the .veix binary container.
export function createPluginPackage(manifest: PluginManifest): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(manifest));
  const gz = gzip(json);
  const parts = [PLUGIN_MAGIC, writeU32(PLUGIN_FORMAT_VERSION), writeU32(gz.length), gz];
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

// Parse and fully validate a .veix buffer, rejecting anything unofficial.
export function validatePluginPackage(data: Uint8Array): PluginManifest {
  if (data.length < 12) {
    throw new PluginPackageError('truncated', 'This file is too small to be an Obsipano plugin.');
  }
  const magic = data.slice(0, 4);
  const matches = magic.length === PLUGIN_MAGIC.length && magic.every((value, index) => value === PLUGIN_MAGIC[index]);
  if (!matches) {
    throw new PluginPackageError('bad-magic', 'This is not an official Obsipano plugin file (.veix).');
  }
  const version = readU32(data, 4);
  if (version !== PLUGIN_FORMAT_VERSION) {
    throw new PluginPackageError('unsupported-version', `Plugin format v${version} is not supported by this Obsipano release.`);
  }
  const jsonLength = readU32(data, 8);
  if (8 + 4 + jsonLength > data.length) {
    throw new PluginPackageError('truncated', 'The plugin file is truncated or corrupted.');
  }
  let manifest: PluginManifest;
  try {
    const json = ungzip(data.slice(12, 12 + jsonLength));
    manifest = JSON.parse(new TextDecoder().decode(json)) as PluginManifest;
  } catch {
    throw new PluginPackageError('bad-manifest', 'The plugin manifest is corrupted and cannot be read.');
  }
  if (manifest?.kind !== 'obsipano-extension' && manifest?.kind !== 'vetour-extension') {
    throw new PluginPackageError('bad-manifest', 'The plugin manifest is missing the Obsipano extension marker.');
  }
  for (const field of ['id', 'name', 'version', 'publisher'] as const) {
    if (typeof manifest[field] !== 'string' || manifest[field].trim() === '') {
      throw new PluginPackageError('bad-manifest', `The plugin manifest is missing a valid "${field}".`);
    }
  }
  if (!isTrustedPublisher(manifest.publisher)) {
    throw new PluginPackageError(
      'untrusted-publisher',
      `Publisher "${manifest.publisher}" is not an official Obsipano publisher. Only official plugins can be installed.`,
    );
  }
  return manifest;
}
