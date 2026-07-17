import * as fs from 'fs/promises';
import * as path from 'path';
import { MODULE_USAGE_FILE, isValidModuleUsageIndexShape, type ModuleUsageIndex } from './moduleUsageTypes';

export class ModuleUsageLoader {
  async load(workspaceRoot: string): Promise<ModuleUsageIndex | undefined> {
    const filePath = path.join(workspaceRoot, MODULE_USAGE_FILE);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (!isValidModuleUsageIndexShape(parsed)) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }
}
