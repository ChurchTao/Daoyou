import { normalizeDungeonResourceTerminology } from '@shared/lib/dungeon/narrativeTerminology';

export function formatDungeonText(text: string): string {
  return normalizeDungeonResourceTerminology(text)
    .replace(/‘/g, '【')
    .replace(/’/g, '】');
}
