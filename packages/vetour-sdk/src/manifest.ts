/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  manifest.ts
 *  Extension manifest, context, and activation signature.
 *-----------------------------------------------------------------------------------------------*/

import type { VetourAPI } from './api';
import type { ExtensionContributions } from './contributions';
import type { Disposable } from './disposable';

/**
A command implementation contributed by an extension.
Payloads must stay serializable for future out-of-process hosts.
*/
export interface ExtensionCommand {
  id: string;
  execute: (payload: never) => unknown;
  canExecute?: (payload: never) => boolean;
}

/**
Activation context collecting disposables for unload.
Push every registration here so unload disposes them in order.
*/
export interface ExtensionContext {
  extensionId: string;
  subscriptions: Disposable[];
}

/**
Static extension description consumed by the host installer.
The `activate` function receives the API and a fresh context.
*/
export interface ExtensionManifest {
  id: string;
  name: string;
  version: string;
  commands?: ExtensionCommand[];
  contributions?: ExtensionContributions;
  activate?: (api: VetourAPI, context: ExtensionContext) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

/**
Declare an extension with full type checking and no runtime cost.
The returned manifest is passed to the host installer.
*/
export function defineExtension(manifest: ExtensionManifest): ExtensionManifest {
  return manifest;
}
