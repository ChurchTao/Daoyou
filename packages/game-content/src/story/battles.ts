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

export const MINE_SPARRING_BATTLE = 'mine-sparring';
export const MINE_BAISHUI_ROGUE_BATTLE = 'mine-baishui-rogue';

export const MINE_SPARRING_MOVES = {
  triple: 'lingxiao.skill.triple',
  pierce: 'wuxiang.skill.pierce',
  wood: 'tianyan.skill.wood',
  fire: 'tianyan.skill.fire',
  siphon: 'youdu.skill.siphon',
  thunder: 'jiujie.skill.thunder_slash',
  guard: 'jiujie.skill.divine_guardian',
  poxie: 'bailu.skill.poxie',
  fuyuan: 'bailu.skill.fuyuan',
  rift: 'wanqiao.skill.pierce',
  pounce: 'xiaoyue.skill.tiger_pounce',
} as const;

export type MineSparringEffect =
  | keyof typeof MINE_SPARRING_MOVES
  | 'wood-fire'
  | 'fire-both'
  | 'thunder-both'
  | 'poxie-both'
  | 'rift-echo'
  | 'beast-followup';

export function mineSparringFlag(effect: MineSparringEffect) {
  return `battle.${MINE_SPARRING_BATTLE}.${effect}`;
}
