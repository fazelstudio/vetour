/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  documentRenderers.ts
 *  Pure document format helpers shared by the viewer and extensions.
 *-----------------------------------------------------------------------------------------------*/

export const CORE_DOCUMENT_EXTENSIONS = ['pdf', 'md', 'txt', 'csv', 'docx', 'xlsx'] as const;

export type CoreDocumentExtension = (typeof CORE_DOCUMENT_EXTENSIONS)[number];

// Extract the file extension without query strings, used to pick a renderer.
export function getDocumentExtension(src: string): string | undefined {
  return src.split('.').pop()?.split('?')[0]?.toLowerCase();
}

// Check whether the built-in viewer can render the extension.
export function isCoreDocumentExtension(extension: string | undefined): boolean {
  if (!extension) return false;
  return (CORE_DOCUMENT_EXTENSIONS as readonly string[]).includes(extension);
}
