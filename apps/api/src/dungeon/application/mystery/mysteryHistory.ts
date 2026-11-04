import type { DungeonHistoryMystery } from '@daoyou/game-domain/dungeon';
import type { MysteryRecord } from '@daoyou/game-domain/dungeon/mystery';
import { projectMysteryView } from '@daoyou/game-rules/dungeon/mystery';
import { requireMysteryTemplate } from './mysteryState.js';

export function mysteryHistorySnapshot(
  mystery: MysteryRecord,
): DungeonHistoryMystery {
  const view = projectMysteryView(
    mystery,
    requireMysteryTemplate(mystery.templateId),
  );
  return {
    title: view.title,
    templateName: view.templateName,
    turn: view.turn,
    clues: view.clues,
    log: view.log,
    ...(view.result ? { result: view.result } : {}),
  };
}
