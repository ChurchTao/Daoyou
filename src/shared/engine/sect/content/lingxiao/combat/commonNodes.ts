import type {
  AbilityConfig,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import { AbilityType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { LINGXIAO_SECT_ID } from '../ids';
import {
  DAMAGE_MODIFIER_PRIORITY,
  DIRECT_DAMAGE_CONDITION,
  resource,
} from './effects';

export function passive(
  slug: string,
  name: string,
  pathId: string,
  listeners: NonNullable<AbilityConfig['listeners']>,
): AbilityConfig {
  return {
    slug,
    name,
    type: AbilityType.PASSIVE_SKILL,
    tags: [
      GameplayTags.ABILITY.KIND.PASSIVE,
      GameplayTags.ABILITY.KIND.SECT,
      GameplayTags.ABILITY.SECT.namespace(LINGXIAO_SECT_ID),
      GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, pathId),
    ],
    listeners,
  };
}

export type AddPassive = (
  id: string,
  name: string,
  listeners: NonNullable<AbilityConfig['listeners']>,
) => void;

export function addCommonNodePassives(args: {
  nodes: Set<string>;
  resourceId: string;
  probingId: string;
  probingName: string;
  probingStatus: EffectConfig;
  hiddenId: string;
  hiddenName: string;
  borrowedId: string;
  borrowedName: string;
  addPassive: AddPassive;
}) {
  const {
    nodes,
    resourceId,
    probingId,
    probingName,
    probingStatus,
    hiddenId,
    hiddenName,
    borrowedId,
    borrowedName,
    addPassive,
  } = args;
  if (nodes.has(probingId)) {
    addPassive(probingId, probingName, [
      {
        id: `sect.lingxiao.${probingId}.counter`,
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
                    'plain-sword',
                  ),
                },
              },
              { type: 'is_hit', params: {} },
            ],
            params: {
              key: `sect.lingxiao.${probingId}`,
              event: 'damage_dealt',
              threshold: 2,
              resetOnTrigger: true,
              effects: [resource(resourceId, 1), probingStatus],
            },
          },
        ],
      },
    ]);
  }

  if (nodes.has(hiddenId)) {
    addPassive(hiddenId, hiddenName, [
      {
        id: `sect.lingxiao.${hiddenId}.first-hit`,
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
          resource(resourceId, 3),
        ],
      },
    ]);
  }

  if (nodes.has(borrowedId)) {
    addPassive(borrowedId, borrowedName, [
      {
        id: `sect.lingxiao.${borrowedId}.damage`,
        eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        budget: { maxTriggers: 1, reset: 'round' },
        conditions: [DIRECT_DAMAGE_CONDITION],
        effects: [resource(resourceId, 1)],
      },
    ]);
  }
}
