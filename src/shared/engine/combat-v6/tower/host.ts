import { AUTO_POLICY_VERSION } from '../../../combat-v6/auto-policy';
import {
  playerAppearances,
  type PresentedBattleInput,
} from '../../../combat-v6/unit-appearance';
import { TOWER_BLESSINGS_PACK } from '../../../lib/tower/blessing-pack';
import type { TowerBlessingId } from '../../../lib/tower/blessings';
import {
  TOWER_CONTENT_VERSION,
  type TowerWeek,
} from '../../../lib/tower/weekly';
import type { RealmType } from '../../../types/constants';
import { BEAST_SKILLS, BEAST_STATUS_DEFS, projectBeastRoster } from '../beasts';
import { isStanding, type Attrs } from '../core';
import type { CombatV6TrainingPlayerInput } from '../encounter';
import {
  CombatV6PveHostSession,
  type PveRestoredState,
} from '../encounter/host';
import { projectCharacterToCombatV6 } from '../projection';
import { daoyouRulesetV6 } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';
import { compileTowerEncounter, type TowerNpcPlan } from './content';
import { publishedTowerEncounter, type PublishedTowerWeek } from './published';

export type TowerBlessings = Partial<Record<TowerBlessingId, number>>;
export const TOWER_V6_VERSIONS = {
  ...COMBAT_V6_PHASE_6D_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v8',
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
export interface TowerBattleSnapshot extends PveRestoredState {
  version: 'tower-v6-v1' | 'tower-v6-v2' | 'tower-v6-v3' | 'tower-v6-v4';
  playerId: string;
  input: PresentedBattleInput;
  npcPlans?: Record<string, TowerNpcPlan>;
}
export class TowerHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      TowerBattleSnapshot,
      'version' | 'playerId' | 'input' | 'npcPlans'
    >,
    restored?: PveRestoredState,
  ) {
    const expectedContent =
      source.version === 'tower-v6-v1'
        ? 'combat-v6-tower-v1'
        : source.version === 'tower-v6-v2'
          ? 'combat-v6-tower-v2'
          : source.version === 'tower-v6-v3'
            ? 'combat-v6-tower-v3'
            : source.input.versions?.contentVersion;
    if (
      !['tower-v6-v1', 'tower-v6-v2', 'tower-v6-v3', 'tower-v6-v4'].includes(
        source.version,
      ) ||
      !expectedContent ||
      source.input.versions?.contentVersion !== expectedContent ||
      (source.version !== 'tower-v6-v1' && !source.npcPlans)
    )
      throw new Error('幻境战斗版本无法恢复');
    super(
      {
        playerId: source.playerId,
        battleInput: {
          ...structuredClone(source.input),
          ruleset: daoyouRulesetV6,
        },
        npcStrategies: {},
        sourceProjectionVersions: COMBAT_V6_PHASE_6D_VERSIONS,
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
        if (!plan) continue; // Old battles continue on their original common AUTO policy.
        let action = plan.cycle[(this.state.round - 1) % plan.cycle.length];
        if (
          action === 'tower.heal' &&
          unit.attrs.mp < 12 &&
          ['tower-v6-v3', 'tower-v6-v4'].includes(this.source.version)
        )
          action = 'tower.support-strike';
        const options = this.battle.queryCommands(unit.id);
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
    version: 'tower-v6-v4',
    playerId: unit.id!,
    npcPlans: enemies.plans,
    input: {
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
