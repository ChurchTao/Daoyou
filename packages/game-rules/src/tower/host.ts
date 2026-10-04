import type { TowerBlessings, TowerBattleSnapshot } from '@daoyou/game-domain/tower';
import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';

import { playerAppearances } from '../combat/unit-appearance.js';

import { TOWER_BLESSINGS_PACK } from '@daoyou/game-content/tower';

import {
  TOWER_CONTENT_VERSION,
  type TowerWeek,
} from './weekly.js';

import type { RealmType } from '@daoyou/constants/realms';

import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';

import { projectBeastRoster } from '../beasts/projection.js';

import { isStanding } from '@daoyou/combat-core/units';

import { type Attrs } from '@daoyou/combat-core/types';

import type { CombatV6TrainingPlayerInput } from '@daoyou/game-domain/combat';

import {
  type PveRestoredState,
  COMBAT_V6_CHARACTER_BUILD_VERSIONS,
} from '@daoyou/game-domain/combat';

import { CombatV6PveHostSession } from '../combat/encounter/host.js';

import { projectCharacterToCombatV6 } from '../combat/projection/project-character.js';

import { daoyouRulesetV6 } from '../combat/daoyou/index.js';


import { compileTowerEncounter } from './content.js';

import { type PublishedTowerWeek } from '@daoyou/game-domain/tower';

import { publishedTowerEncounter } from './published.js';

export const TOWER_V6_VERSIONS = {
  ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v11',
  contentVersion: TOWER_CONTENT_VERSION,
} as const;

function applyBlessings(
  attrs: Partial<Attrs>,
  blessings: TowerBlessings,
  target: 'player' | 'beasts',
  pack = TOWER_BLESSINGS_PACK,
) {
  const base = { ...attrs };
  for (const rule of pack.blessings) {
    if (rule.effect.target !== target) continue;
    const stacks = Math.max(
      0,
      Math.min(rule.maxStacks, Math.floor(blessings[rule.id] ?? 0)),
    );
    for (const key of rule.effect.attributes)
      attrs[key] = Math.floor(
        (base[key] ?? 0) * (1 + stacks * rule.effect.perStack),
      );
  }
}

export function projectTowerPlayer(
  player: CombatV6TrainingPlayerInput,
  blessings: TowerBlessings,
  pack = TOWER_BLESSINGS_PACK,
) {
  const projected = projectCharacterToCombatV6({
    ...structuredClone(player),
    side: 0,
    slot: 0,
    resourcePolicy: 'full',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  applyBlessings(projected.unit.attrs, blessings, 'player', pack);
  return projected;
}

export class TowerHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      TowerBattleSnapshot,
      'version' | 'playerId' | 'input' | 'npcPlans'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'tower-v6-v8' ||
      source.input.versions?.contentVersion !== TOWER_CONTENT_VERSION ||
      !source.npcPlans
    )
      throw new Error('幻境内容已更新，请重新进入');
    super(
      {
        playerId: source.playerId,
        battleInput: {
          ...structuredClone(source.input),
          ruleset: daoyouRulesetV6,
        },
        npcStrategies: {},
        sourceProjectionVersions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
        playerAutoStrategy: source.input.autoStrategy,
      },
      restored,
      source.input.unitAppearances,
    );
  }
  override resolveRound(
    afterAction?: Parameters<CombatV6PveHostSession['resolveRound']>[0],
  ) {
    // Plans are frozen with the battle. Missed/sealed actions never shift the cycle.
    // The shared engine still checks resources, status restrictions, targets and damage.
    if (!this.finished && this.state.phase === 'command') {
      for (const unit of this.state.units.filter(
        (u) => u.side === 1 && isStanding(u),
      )) {
        if (unit.command) continue;
        const plan = this.source.npcPlans?.[unit.id];
        if (!plan) throw new Error('幻境缺少行动方案');
        let action = plan.cycle[(this.state.round - 1) % plan.cycle.length];
        const options = this.battle.queryCommands(unit.id);
        const planned = options.skills.find((s) => s.skillId === action);
        if (planned && unit.attrs.mp < planned.costs.mp) action = plan.fallback;
        if (!options.canSubmit) continue;
        const skill = options.skills.find((s) => s.skillId === action);
        if (skill?.selectableTargetIds.length) {
          this.battle.submit(unit.id, {
            type: 'skill',
            skillId: action,
            targets: skill.selectableTargetIds.slice(0, skill.targetCount),
          });
        } else if (action === 'attack' && options.attackTargetIds[0]) {
          this.battle.submit(unit.id, {
            type: 'attack',
            target: options.attackTargetIds[0],
          });
        } else this.battle.submit(unit.id, { type: 'defend' });
      }
    }
    return super.resolveRound(afterAction);
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
  week: TowerWeek | undefined,
  seed: number,
  published?: PublishedTowerWeek,
) {
  if (!published && !week) throw new Error('幻境周配置缺失');
  const projected = projectTowerPlayer(player, blessings);
  const unit = projected.unit;
  const beasts = projectBeastRoster(player.beasts, unit.id!, 0, 0, unit.level);
  for (const beast of beasts) applyBlessings(beast.attrs, blessings, 'beasts');
  const enemies = published
    ? publishedTowerEncounter(published, realm, floor)
    : compileTowerEncounter(realm, floor, week!);
  return new TowerHost({
    version: 'tower-v6-v8',
    playerId: unit.id!,
    npcPlans: enemies.plans,
    input: {
      autoStrategy: player.autoStrategy,
      unitAppearances: playerAppearances(player),
      seed,
      versions: {
        ...TOWER_V6_VERSIONS,
        contentVersion: published?.contentVersion ?? week!.version,
      },
      units: [unit, ...beasts, ...enemies.units],
      skills: [...projected.skills, ...BEAST_SKILLS, ...enemies.skills],
      statusDefs: [
        ...projected.statusDefs,
        ...BEAST_STATUS_DEFS,
        ...enemies.statusDefs,
      ],
    },
  });
}
