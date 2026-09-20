/*-----------------------------------------------------------------------------------------------
 *  Copyright (c) Zulfazli (fazelstudio). All rights reserved.
 *  Licensed under the MIT License. See LICENSE file in the project root for license information.
 *
 *  projectEntry.ts
 *  Recent project entry shown on the home screen.
 *-----------------------------------------------------------------------------------------------*/

export interface ProjectEntry {
  id: string;
  name: string;
  folderPath: string;
  createdAt: string;
  lastOpenedAt: string;
}