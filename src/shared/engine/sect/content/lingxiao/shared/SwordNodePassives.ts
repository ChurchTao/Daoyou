import type { EffectConfig } from '@shared/engine/battle-v5/core/configs';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  DAMAGE_MODIFIER_PRIORITY,
  DIRECT_DAMAGE_CONDITION,
  SectAbilityFactory,
  sectEffects,
  type SectBuildBuilder,
  type SectNodeApplyContext,
} from '../../../core';
import { LINGXIAO_SECT_ID } from '../ids';

function addPassive(
  context: SectNodeApplyContext,
  builder: SectBuildBuilder,
  args: {
    id: string;
    name: string;
    listeners: NonNullable<
      import('@shared/engine/battle-v5/core/configs').AbilityConfig['listeners']
    >;
  },
): void {
  const factory = new SectAbilityFactory(LINGXIAO_SECT_ID, context.realm);
  builder.addPassive(factory.passive({ ...args, pathId: context.path.pathId }));
}

export function addProbingNodePassive(
  context: SectNodeApplyContext,
  builder: SectBuildBuilder,
  args: {
    id: string;
    name: string;
    resourceId: string;
    basicAbilityId: string;
    statusEffect: EffectConfig;
  },
): void {
  addPassive(context, builder, {
    id: args.id,
    name: args.name,
    listeners: [
      {
        id: `sect.lingxiao.${args.id}.counter`,
        eventType: GameplayTags.EVENT.SKILL_CAST,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
        priority: 0,
        mapping: { caster: 'owner', target: 'event.target' },
        effects: [
          {
            type: 'turn_state_counter',
            conditions: [
              {
                type: 'ability_has_tag',
                params: {
                  tag: GameplayTags.ABILITY.SECT.ability(
                    LINGXIAO_SECT_ID,
                    args.basicAbilityId,
                  ),
                },
              },
              { type: 'is_hit', params: {} },
            ],
            params: {
              key: `sect.lingxiao.${args.id}`,
              event: 'damage_dealt',
              threshold: 2,
              resetOnTrigger: true,
              effects: [
                sectEffects.modifyResource(args.resourceId, 1),
                args.statusEffect,
              ],
            },
          },
        ],
      },
    ],
  });
}

export function addHiddenNodePassive(
  context: SectNodeApplyContext,
  builder: SectBuildBuilder,
  args: { id: string; name: string; resourceId: string },
): void {
  addPassive(context, builder, {
    id: args.id,
    name: args.name,
    listeners: [
      {
        id: `sect.lingxiao.${args.id}.first-hit`,
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'owner' },
        budget: { maxTriggers: 1, reset: 'battle' },
        conditions: [DIRECT_DAMAGE_CONDITION],
        effects: [
          {
            type: 'percent_damage_modifier',
            params: { mode: 'reduce', value: 0.1 },
          },
          sectEffects.modifyResource(args.resourceId, 3),
        ],
      },
    ],
  });
}

export function addBorrowedNodePassive(
  context: SectNodeApplyContext,
  builder: SectBuildBuilder,
  args: { id: string; name: string; resourceId: string },
): void {
  addPassive(context, builder, {
    id: args.id,
    name: args.name,
    listeners: [
      {
        id: `sect.lingxiao.${args.id}.damage`,
        eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        budget: { maxTriggers: 1, reset: 'round' },
        conditions: [DIRECT_DAMAGE_CONDITION],
        effects: [sectEffects.modifyResource(args.resourceId, 1)],
      },
    ],
  });
}

export function addLingxiaoPassive(
  context: SectNodeApplyContext,
  builder: SectBuildBuilder,
  args: Parameters<typeof addPassive>[2],
): void {
  addPassive(context, builder, args);
}
