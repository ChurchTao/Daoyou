import { ActiveSkill } from '../abilities/ActiveSkill';
import type { BattleRoster } from '../core/BattleRoster';
import { peekQueuedAction } from '../core/runtimeState';
import { TargetSelectionSystem } from '../systems/TargetSelectionSystem';
import { resolveLegalBasicAttack } from './BasicAttackResolver';
import { resolveLegalQueuedAction } from './QueuedActionResolver';
import type { BattlePlanningViewV1, PlanningAbilityViewV1 } from './types';

export function createBattlePlanningView(input: {
  roster: BattleRoster;
  round: number;
  checkpointRevision: number;
  unitIds: readonly string[];
}): BattlePlanningViewV1 {
  const targetSystem = new TargetSelectionSystem();
  const allUnits = input.roster.getAllUnits();
  const units = allUnits
    .filter((unit) => input.unitIds.includes(unit.id))
    .sort(
      (left, right) =>
        input.unitIds.indexOf(left.id) - input.unitIds.indexOf(right.id),
    )
    .map((unit) => {
      const queued = unit.isAlive() ? peekQueuedAction(unit) : undefined;
      const queuedAction = queued
        ? resolveLegalQueuedAction(unit, allUnits)
        : null;
      const defaultAttack = unit.isAlive()
        ? unit.abilities.getDefaultAttack()
        : undefined;
      const basicAttack = unit.isAlive()
        ? resolveLegalBasicAttack(unit, allUnits)
        : null;
      return {
        unitId: unit.id,
        teamId: unit.teamId,
        alive: unit.isAlive(),
        basicAttack: unit.isAlive()
          ? {
              abilityId: 'basic_attack' as const,
              name: defaultAttack?.name ?? '普攻',
              ready: Boolean(basicAttack),
              unavailableReason: basicAttack
                ? undefined
                : ('no_target' as const),
              legalTargetIds:
                basicAttack?.legalTargets.map((target) => target.id) ?? [],
            }
          : undefined,
        forcedAction: queuedAction
          ? {
              kind: 'queued_action_target' as const,
              abilityId: queuedAction.ability.id,
              abilityName: queuedAction.ability.name,
              legalTargetIds: queuedAction.legalTargets.map(
                (target) => target.id,
              ),
            }
          : undefined,
        abilities: unit.isAlive() && !queued
        ? unit.abilities
            .getAllAbilities()
            .filter(
              (ability): ability is ActiveSkill =>
                ability instanceof ActiveSkill,
            )
            .map((ability): PlanningAbilityViewV1 => {
              const candidates = targetSystem.getTargetCandidates(
                unit,
                ability.targetPolicy,
                allUnits,
              );
              const hasEnoughResources = ability.hasEnoughResources(unit);
              const hasTriggerableTarget = candidates.some((target) =>
                ability.canTrigger({ caster: unit, target }),
              );
              return {
                abilityId: ability.id,
                name: ability.name,
                description: ability.description,
                visual: ability.getSerializableConfig()?.presentation?.visual,
                costs: ability.resourceCosts.map((cost) => ({
                  resource: cost.type,
                  amount: cost.amount,
                  mode: cost.mode,
                })),
                cooldown: {
                  current: ability.currentCooldown,
                  max: ability.maxCooldown,
                },
                ready:
                  ability.isReady() &&
                  hasEnoughResources &&
                  hasTriggerableTarget,
                unavailableReason: !ability.isReady()
                  ? 'cooldown'
                  : candidates.length === 0
                    ? 'no_target'
                    : !hasEnoughResources
                      ? 'resource'
                      : hasTriggerableTarget
                        ? undefined
                        : 'condition',
                targetTeam: ability.targetPolicy.team,
                targetScope: ability.targetPolicy.scope,
                legalTargetIds: candidates.map((target) => target.id),
              };
            })
        : [],
      };
    });
  return {
    version: 'battle_planning_view_v1',
    round: input.round,
    checkpointRevision: input.checkpointRevision,
    units,
  };
}
