import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { BuffType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { SectStrategyCandidates, type SectTacticId } from '../../core';
import { TIANYAN_SECT_ID } from './ids';
import {
  TIANYAN_ELEMENTS,
  TIANYAN_SEAL_STATE_TAGS,
  getTianyanReaction,
  type TianyanElement,
} from './shared/reactions';

const ABILITY_ELEMENTS: Partial<Record<string, TianyanElement>> = {
  'verdant-pulse': 'wood',
  'flowing-flame': 'fire',
  'earth-bearing-seal': 'earth',
  'metal-cloud-cutter': 'metal',
  'white-star-breaker': 'metal',
  'dark-water-return': 'water',
};

function contentAbilityId(runtimeId: string): string {
  const prefix = `sect.${TIANYAN_SECT_ID}.`;
  return runtimeId.startsWith(prefix) ? runtimeId.slice(prefix.length) : runtimeId;
}

function hasDispellableBuff(context: AbilitySelectionContext): boolean {
  return context.opponent?.buffs.getAllBuffs().some(
    (buff) =>
      buff.type === BuffType.BUFF &&
      buff.countsAsStatus &&
      buff.dispelPolicy === 'normal',
  ) ?? false;
}

function currentSeal(context: AbilitySelectionContext): TianyanElement | undefined {
  const target = context.opponent;
  if (!target) return undefined;
  return TIANYAN_ELEMENTS.find((element) =>
    target.tags.hasTag(TIANYAN_SEAL_STATE_TAGS[element]),
  );
}

function abilityIdsByReaction(
  context: AbilitySelectionContext,
  kind: 'generation' | 'overcoming' | 'any',
): string[] {
  const seal = currentSeal(context);
  if (!seal) return [];
  return context.candidates
    .map((candidate) => {
      const id = contentAbilityId(candidate.ability.id);
      const element = ABILITY_ELEMENTS[id];
      if (!element) return undefined;
      const reaction = getTianyanReaction(seal, element);
      if (
        reaction.kind !== 'generation' &&
        reaction.kind !== 'overcoming'
      ) return undefined;
      return kind === 'any' || reaction.kind === kind ? id : undefined;
    })
    .filter((id): id is string => Boolean(id));
}

abstract class TianyanSelectionStrategy implements AbilitySelectionStrategy {
  constructor(protected readonly tacticId: SectTacticId) {}

  abstract select(
    context: AbilitySelectionContext,
  ): AbilitySelectionResult | null;

  protected pick(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score = 600,
  ): AbilitySelectionResult | null {
    const index = new SectStrategyCandidates(TIANYAN_SECT_ID, context.candidates);
    for (const id of priorities) {
      const result = index.result(id, score);
      if (result) return result;
    }
    const fallback = context.candidates[0];
    return fallback
      ? { ability: fallback.ability, target: fallback.target, score: 100 }
      : null;
  }

  protected reactionPriorities(
    context: AbilitySelectionContext,
    kind: 'generation' | 'overcoming' | 'any',
  ): string[] {
    return abilityIdsByReaction(context, kind);
  }
}

export class HetuSelectionStrategy extends TianyanSelectionStrategy {
  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const hp = context.caster.getHpPercent();
    const mp = context.caster.getMpPercent();
    const reactions = this.reactionPriorities(context, 'any');
    if (this.tacticId === 'nourish-origin') {
      if (hp < 0.60) {
        return this.pick(
          context,
          ['myriad-wood-renewal', 'boundless-earth', ...reactions],
          760,
        );
      }
      if (mp < 0.35) {
        return this.pick(
          context,
          ['heavenly-river-cleansing', 'five-qi-repository', ...reactions],
          750,
        );
      }
    }
    if (this.tacticId === 'unbroken-flow' && currentSeal(context) && reactions.length === 0) {
      return this.pick(context, ['shift-palace', 'primordial-ray'], 740);
    }
    if (reactions.length > 0) return this.pick(context, reactions, 720);
    return this.pick(
      context,
      ['verdant-pulse', 'earth-bearing-seal', 'dark-water-return', 'flowing-flame'],
    );
  }
}

export class LuoshuSelectionStrategy extends TianyanSelectionStrategy {
  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const overcoming = this.reactionPriorities(context, 'overcoming');
    const anyReaction = this.reactionPriorities(context, 'any');
    if (this.tacticId === 'lock-meridian') {
      const controlImmune = context.opponent?.tags.hasTag(
        GameplayTags.STATUS.IMMUNE.CONTROL,
      ) ?? false;
      const lock = overcoming.filter((id) =>
        id === 'white-star-breaker' ||
        id === 'metal-cloud-cutter' ||
        id === 'earth-bearing-seal',
      );
      if (!controlImmune && lock.length > 0) return this.pick(context, lock, 780);
      if (currentSeal(context)) {
        return this.pick(context, ['shift-palace', ...anyReaction], 720);
      }
    }
    if (this.tacticId === 'break-pattern') {
      if (overcoming.length > 0) {
        const priorities = hasDispellableBuff(context) &&
          overcoming.includes('white-star-breaker')
          ? ['white-star-breaker', ...overcoming]
          : overcoming;
        return this.pick(
          context,
          priorities,
          760,
        );
      }
      if (anyReaction.length > 0) return this.pick(context, anyReaction, 700);
    }
    if (this.tacticId === 'decisive-derivation') {
      if (anyReaction.length > 0) {
        const expectedDamageOrder = [
          'metal-cloud-cutter',
          'flowing-flame',
          'dark-water-return',
          'earth-bearing-seal',
          'verdant-pulse',
          'white-star-breaker',
        ].filter((id) => anyReaction.includes(id));
        return this.pick(
          context,
          [...expectedDamageOrder, ...anyReaction],
          760,
        );
      }
      if (currentSeal(context)) {
        return this.pick(
          context,
          ['shift-palace', 'five-qi-repository', 'primordial-ray'],
          700,
        );
      }
    }
    return this.pick(
      context,
      [...overcoming, ...anyReaction, 'metal-cloud-cutter', 'flowing-flame'],
    );
  }
}
