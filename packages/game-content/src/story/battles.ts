import { StoryBattleSchema, type StoryBattle } from '@daoyou/game-domain/story';
import raw from './data/battles.json' with { type: 'json' };

const battles = new Map<string, StoryBattle>();
for (const entry of raw) {
  const battle = StoryBattleSchema.parse(entry);
  if (battles.has(battle.id)) throw new Error(`剧情战重复：${battle.id}`);
  battles.set(battle.id, battle);
}

export function hasStoryBattle(id: string): boolean {
  return battles.has(id);
}

export function getStoryBattle(id: string): StoryBattle {
  const battle = battles.get(id);
  if (!battle) throw new Error(`没有这场剧情战：${id}`);
  return battle;
}
