/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  vetourFile.ts
 *  Reader and writer for the compressed .vetour project file format.
 *-----------------------------------------------------------------------------------------------*/

import { writeFile, readFile, mkdir } from '@tauri-apps/plugin-fs';
import { join, tempDir } from '@tauri-apps/api/path';
import { convertFileSrc } from '@tauri-apps/api/core';
import { gzip, ungzip } from 'pako';
import type { TourProject } from '../types/tour';
import { normalizeProject, validateProject } from './projectValidation';

const V1_MAGIC = new Uint8Array([0x56, 0x54, 0x00, 0x01]);
const V2_MAGIC = new Uint8Array([0x56, 0x54, 0x00, 0x02]);

function concatBuffers(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

function writeU32(v: number): Uint8Array {
  const b = new ArrayBuffer(4);
  new DataView(b).setUint32(0, v, true);
  return new Uint8Array(b);
}

function readU32(data: Uint8Array, offset: number): number {
  return new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);
}

function arraysEq(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function collectPaths(project: TourProject): string[] {
  const s = new Set<string>();
  for (const sc of project.scenes) {
    if (sc.panorama && !sc.panorama.startsWith('blob:')) s.add(sc.panorama);
    if (sc.thumbnail && !sc.thumbnail.startsWith('blob:')) s.add(sc.thumbnail);
    for (const m of sc.markers) {
      if (m.image && !m.image.startsWith('blob:')) s.add(m.image);
      if (m.data) {
        const d = m.data as Record<string, unknown>;
        if (typeof d.audio === 'string' && !d.audio.startsWith('blob:')) s.add(d.audio);
        if (typeof d.video === 'string' && !d.video.startsWith('blob:')) s.add(d.video);
      }
    }
  }
  for (const a of project.assets) {
    if (a.path && !a.path.startsWith('blob:')) s.add(a.path);
  }
  return [...s];
}



function decompressJson(data: Uint8Array): TourProject {
  let d: Uint8Array;
  try {
    d = ungzip(data);
  } catch {
    throw new Error('Project data is corrupted (gzip decompression failed).');
  }
  let s: string;
  try {
    s = new TextDecoder().decode(d);
  } catch {
    throw new Error('Project data is corrupted (text decoding failed).');
  }
  try {
    const project = JSON.parse(s) as TourProject;
    const validation = validateProject(project);
    if (validation.issues.some((issue) => issue.code === 'invalid-project' || issue.code === 'duplicate-id')) {
      throw new Error('Project data is invalid or corrupted.');
    }
    return normalizeProject(project);
  } catch {
    throw new Error('Project data is corrupted (JSON parse failed).');
  }
}

/*
Blob URL cache for assets extracted from .vetour files.
Maps original paths to blob URLs so they can be revoked on close or reload.
*/
export const blobUrlCache = new Map<string, string>();
export const blobDataCache = new Map<string, Uint8Array>(); // Blob URL to raw bytes for saving.

export function revokeVetourBlobs(): void {
  for (const url of blobUrlCache.values()) {
    URL.revokeObjectURL(url);
  }
  blobUrlCache.clear();
  blobDataCache.clear();
}

export function saveVetourFile(path: string, project: TourProject): Promise<void> {
  return _saveVetourFile(path, project, readFile);
}

async function _saveVetourFile(
  path: string,
  project: TourProject,
  diskRead: (p: string) => Promise<Uint8Array>,
): Promise<void> {
  // Collect paths that still reference the filesystem instead of blob URLs.
  const assetPaths = collectPaths(project);

  const files: { p: string; bin: Uint8Array }[] = [];

  for (const p of assetPaths) {
    try {
      if (blobUrlCache.has(p)) {
        const blobUrl = blobUrlCache.get(p)!;
        const data = blobDataCache.get(blobUrl);
        if (data) {
          files.push({ p, bin: data });
          continue;
        }
      }
      const bin = await diskRead(p);
      files.push({ p, bin });
    } catch {
      // Skip files that cannot be read.
    }
  }

  const chunks: Uint8Array[] = [];
  chunks.push(writeU32(files.length));
  for (const f of files) {
    const pe = new TextEncoder().encode(f.p);
    chunks.push(writeU32(pe.length), pe, writeU32(f.bin.length), f.bin);
  }
  const binSection = concatBuffers(chunks);

  const json = JSON.stringify(project);
  const gz = gzip(new TextEncoder().encode(json));

  await writeFile(path, concatBuffers([V2_MAGIC, binSection, writeU32(gz.length), gz]));
}

export async function loadVetourFile(filePath: string): Promise<TourProject> {
  const raw = await readFile(filePath);

  if (raw.length < 4) {
    throw new Error('File is too small or corrupted.');
  }

  const magic = raw.slice(0, 4);

  // Legacy v1 format with gzip JSON only.
  if (arraysEq(magic, V1_MAGIC)) {
    return decompressJson(raw.slice(4));
  }

  // V2 format with embedded binary assets.
  if (arraysEq(magic, V2_MAGIC)) {
    // Revoke blobs from the previous load before replacing them.
    revokeVetourBlobs();

    let off = 4;
    const fileCount = readU32(raw, off);
    off += 4;

    const pathMap = new Map<string, string>();

    for (let i = 0; i < fileCount; i++) {
      if (off + 4 > raw.length) throw new Error('File corrupted: unexpected end while reading asset paths.');
      const plen = readU32(raw, off);
      off += 4;
      if (off + plen > raw.length) throw new Error('File corrupted: asset path truncated.');
      const origPath = new TextDecoder().decode(raw.slice(off, off + plen));
      off += plen;

      if (off + 4 > raw.length) throw new Error('File corrupted: unexpected end while reading asset data length.');
      const dlen = readU32(raw, off);
      off += 4;
      if (off + dlen > raw.length) throw new Error('File corrupted: asset data truncated.');
      const fdata = raw.slice(off, off + dlen);
      off += dlen;

      const safeName = origPath.replace(/[/\\]/g, '_');

      
      const tDir = await tempDir();
      const sessionDir = await join(tDir, 'vetour_session');
      await mkdir(sessionDir, { recursive: true });
      const tempPath = await join(sessionDir, safeName);
      await writeFile(tempPath, fdata);
      const assetUrl = convertFileSrc(tempPath);

      blobUrlCache.set(origPath, assetUrl);
      blobDataCache.set(assetUrl, fdata);
      pathMap.set(origPath, assetUrl);
    }

    if (off + 4 > raw.length) throw new Error('File corrupted: missing JSON section length.');
    const jlen = readU32(raw, off);
    off += 4;
    if (off + jlen > raw.length) throw new Error('File corrupted: JSON section truncated.');

    const project = decompressJson(raw.slice(off, off + jlen));
    return project;
  }

  throw new Error('This is not a valid Vetour project file.');
}
