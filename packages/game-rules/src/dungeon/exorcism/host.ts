import { isStanding } from '@daoyou/combat-core/units';
import type { RealmType } from '@daoyou/constants/realms';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';
import {
  COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  type CombatV6TrainingPlayerInput,
  type CombatV6UnitAppearance,
  type PveRestoredState,
} from '@daoyou/game-domain/combat';
import { AUTO_POLICY_VERSION } from '@daoyou/game-domain/combat/auto';
import type { DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';
import type {
  ExorcismBattleSnapshot,
  ExorcismRunState,
} from '@daoyou/game-domain/dungeon/exorcism';
import { projectBeastRoster } from '../../beasts/projection.js';
import { daoyouRulesetV6 } from '../../combat/daoyou/index.js';
import { CombatV6PveHostSession } from '../../combat/encounter/host.js';
import { projectCharacterToCombatV6 } from '../../combat/projection/project-character.js';
import { playerAppearances } from '../../combat/unit-appearance.js';
import {
  compileExorcismEncounter,
  EXORCISM_SKILLS,
  EXORCISM_STATUS_DEFS,
} from './encounter.js';
import { exorcismCurrentStage } from './state.js';

export const EXORCISM_VERSIONS = {
  ...COMBAT_V6_CHARACTER_BUILD_VERSIONS,
  autoPolicyVersion: AUTO_POLICY_VERSION,
  rulesetVersion: 'daoyou_rules_v13' as const,
  contentVersion: 'combat-v6-exorcism-v1' as const,
};

export class ExorcismHost extends CombatV6PveHostSession {
  constructor(
    private readonly source: Pick<
      ExorcismBattleSnapshot,
      'version' | 'playerId' | 'input' | 'npcPlans'
    >,
    restored?: PveRestoredState,
  ) {
    if (
      source.version !== 'exorcism-v6-v1' ||
      source.input.versions?.contentVersion !== EXORCISM_VERSIONS.contentVersion
    )
      throw new Error('除祟战斗版本无法恢复');
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
    // 行动方案随战斗冻结：被控制错过一步不会错位。合法性仍由引擎检查。
    if (!this.finished && this.state.phase === 'command') {
      for (const unit of this.state.units.filter(
        (u) => u.side === 1 && isStanding(u),
      )) {
        if (unit.command) continue;
        const plan = this.source.npcPlans[unit.id];
        if (!plan) throw new Error('除祟敌人缺少行动方案');
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
        } else if (action !== 'defend' && options.attackTargetIds[0]) {
          this.battle.submit(unit.id, {
            type: 'attack',
            target: options.attackTargetIds[0],
          });
        } else this.battle.submit(unit.id, { type: 'defend' });
      }
    }
    return super.resolveRound(afterAction);
  }

  runtimeSnapshot(): ExorcismBattleSnapshot {
    return structuredClone({ ...this.source, ...this.recordedState() });
  }

  trace() {
    return this.traceData();
  }

  /** 战斗结束时的局内资源，交给 applyExorcismBattle 入账。 */
  finalHpRatio() {
    const player = this.state.units.find((unit) => unit.id === this.playerId);
    if (!player) throw new Error('除祟战局缺少人物');
    return player.attrs.maxHp > 0 ? player.attrs.hp / player.attrs.maxHp : 0;
  }

}

export function createExorcismHost(
  player: CombatV6TrainingPlayerInput,
  encounter: { realm: RealmType; tier: DungeonDifficultyTier },
  run: Pick<ExorcismRunState, 'wins' | 'bossId' | 'lineageId'>,
  seed: number,
  leadIdentity?: { name: string; appearance: CombatV6UnitAppearance },
) {
  const projected = projectCharacterToCombatV6({
    ...structuredClone(player),
    side: 0,
    slot: 0,
    resourcePolicy: 'persistent',
  });
  if (!projected.ok) throw new Error('请先完成新版宗门构筑');
  const unit = projected.unit;
  const beasts = projectBeastRoster(player.beasts, unit.id!, 0, 0, unit.level, 'persistent');
  const compiled = compileExorcismEncounter({
    ...encounter,
    stage: exorcismCurrentStage(run),
    bossId: run.bossId,
    lineageId: run.lineageId,
  });
  if (leadIdentity) {
    const lead = compiled.units[0];
    lead.name = leadIdentity.name;
    compiled.appearances[lead.id!] = leadIdentity.appearance;
  }
  return new ExorcismHost({
    version: 'exorcism-v6-v1',
    playerId: unit.id!,
    npcPlans: compiled.plans,
    input: {
      autoStrategy: player.autoStrategy,
      unitAppearances: {
        ...playerAppearances(player),
        ...compiled.appearances,
      },
      seed,
      versions: EXORCISM_VERSIONS,
      units: [unit, ...beasts, ...compiled.units],
      skills: [...projected.skills, ...BEAST_SKILLS, ...EXORCISM_SKILLS],
      statusDefs: [
        ...projected.statusDefs,
        ...BEAST_STATUS_DEFS,
        ...EXORCISM_STATUS_DEFS,
      ],
    },
  });
}
