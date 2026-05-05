import {
  getAllCombatStatusTemplates,
  getCombatStatusDisplay,
} from '@/engine/battle-v5/setup/CombatStatusTemplateRegistry';
import type { CombatStatusTemplateDisplay } from '@/engine/battle-v5/setup/types';

export interface BuffDisplayConfig extends CombatStatusTemplateDisplay {}

export function getBuffDisplayConfig(
  buffId: string,
): BuffDisplayConfig | undefined {
  return getCombatStatusDisplay(buffId);
}

export function buffHasAction(buffId: string): boolean {
  const config = getCombatStatusDisplay(buffId);
  return !!(config?.action && config.path);
}

export function getAllBuffDisplayConfigs(): Record<string, BuffDisplayConfig> {
  return Object.fromEntries(
    getAllCombatStatusTemplates().map((template) => [
      template.id,
      template.display,
    ]),
  );
}
