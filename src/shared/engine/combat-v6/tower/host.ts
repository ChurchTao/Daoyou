import { TOWER_BASE_ATTRIBUTES, TOWER_BLESSINGS_PACK, towerBlessingResourceRatio } from '../../../lib/tower/blessing-pack';
import type { TowerBlessingId } from '../../../lib/tower/blessings';
import { TOWER_MAX_FLOOR } from '../../../lib/tower/helpers';
import { compileTowerEnemies } from './content';
export { TOWER_ENEMY_CONFIG } from './content';
import type { RealmType } from '../../../types/constants';
import { BEAST_SKILLS, projectBeastRoster } from '../beasts';
import { type CreateBattleInput } from '../core';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  CombatV6PveHostSession,
  type PveRestoredState,
} from '../encounter/host';
import { projectCharacterToCombatV6 } from '../projection';
import { daoyouRulesetV6 } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

export type TowerBlessings = Partial<Record<TowerBlessingId, number>>;
export type TowerResources = Record<string, { hp: number; mp: number }>;
export const TOWER_V6_VERSIONS = {
  ...COMBAT_V6_PHASE_6D_VERSIONS,
  rulesetVersion: 'daoyou_rules_v8',
  contentVersion: 'combat-v6-tower-v1',
} as const;

export function projectTowerPlayer(
  player: CombatV6TrainingPlayerInput,
  blessings: TowerBlessings,
  pack = TOWER_BLESSINGS_PACK,
) {
  const input = structuredClone(player);
  for (const key of TOWER_BASE_ATTRIBUTES) {
    let multiplier = 1;
    for (const blessing of pack.blessings) {
      const effect = blessing.effect;
      if (effect.kind === 'allAttributes' || (effect.kind === 'attribute' && effect.attribute === key)) multiplier += (blessings[blessing.id] ?? 0) * effect.perStack;
    }
    input.cultivator.attributes[key] *= multiplier;
  }
  const projected = projectCharacterToCombatV6({
    ...input,
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  const attrs = projected.unit.attrs!;
  attrs.maxHp = attrs.hp = Math.floor(
    attrs.maxHp! * (1 + towerBlessingResourceRatio(blessings, 'resourceMax', 'hp', pack)),
  );
  attrs.maxMp = attrs.mp = Math.floor(
    attrs.maxMp! * (1 + towerBlessingResourceRatio(blessings, 'resourceMax', 'mp', pack)),
  );
  return projected;
}

export function towerResourceRatio(
  current: number,
  oldMax: number,
  newMax: number,
) {
  return Math.max(
    0,
    Math.min(newMax, Math.floor(oldMax > 0 ? (current / oldMax) * newMax : 0)),
  );
}
export function towerRecovery(current: number, max: number, fraction: number) {
  return Math.min(
    max,
    Math.max(0, current) + Math.floor(Math.max(0, max - current) * fraction),
  );
}

export interface TowerBattleSnapshot extends PveRestoredState {
  version: 'tower-v6-v1';
  playerId: string;
  input: Omit<CreateBattleInput, 'ruleset'>;
}
export class TowerHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      TowerBattleSnapshot,
      'version' | 'playerId' | 'input'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'tower-v6-v1' ||
      source.input.versions?.contentVersion !== TOWER_V6_VERSIONS.contentVersion
    )
      throw new Error('幻境战斗版本无法恢复');
    super(
      {
        playerId: source.playerId,
        battleInput: {
          ...structuredClone(source.input),
          ruleset: daoyouRulesetV6,
        },
        npcStrategies: Object.fromEntries(
          source.input.units
            .filter((u) => u.side === 1)
            .map((u) => [u.id!, { type: 'attack' as const }]),
        ),
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
      },
      restored,
    );
  }
  runtimeSnapshot(): TowerBattleSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }
  trace() {
    return this.traceData();
  }
}

export function createTowerHost(
  player: CombatV6TrainingPlayerInput,
  realm: RealmType,
  floor: number,
  blessings: TowerBlessings,
  resources: TowerResources,
  seed: number,
) {
  if (!Number.isInteger(floor) || floor < 1 || floor > TOWER_MAX_FLOOR)
    throw new Error('幻境层数无效');
  const projected = projectTowerPlayer(player, blessings);
  const unit = projected.unit;
  const attrs = unit.attrs!;
  const previous = resources[unit.id!];
  if (previous) {
    attrs.hp = towerRecovery(
      previous.hp,
      attrs.maxHp!,
      towerBlessingResourceRatio(blessings, 'recovery', 'hp'),
    );
    attrs.mp = towerRecovery(
      previous.mp,
      attrs.maxMp!,
      towerBlessingResourceRatio(blessings, 'recovery', 'mp'),
    );
  }
  const beasts = projectBeastRoster(
    player.beasts,
    unit.id!,
    0,
    0,
    unit.level,
  ).flatMap((beast) => {
    const resource = resources[beast.id!];
    if (resource?.hp === 0) return [];
    if (resource)
      beast.attrs = {
        ...beast.attrs,
        hp: Math.min(beast.attrs!.maxHp!, resource.hp),
        mp: Math.min(beast.attrs!.maxMp!, resource.mp),
      };
    return [beast];
  });
  const enemies = compileTowerEnemies(realm, floor);
  return new TowerHost({
    version: 'tower-v6-v1',
    playerId: unit.id!,
    input: {
      seed,
      versions: TOWER_V6_VERSIONS,
      units: [unit, ...beasts, ...enemies],
      skills: [...projected.skills, ...BEAST_SKILLS],
      statusDefs: projected.statusDefs,
    },
  });
}
