import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { BuffType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { SectStrategyCandidates, type SectTacticId } from '../../core';
import {
  TIANYAN_SECT_ID,
} from './ids';
import {
  TIANYAN_ELEMENTS,
  TIANYAN_LANDING_BASE_DAMAGE,
  TIANYAN_SEAL_STATE_TAGS,
  getTianyanReaction,
  tianyanReactionElementMarkerTag,
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

function expectedReactionDamage(
  abilityId: string,
  seal: TianyanElement,
): number {
  const element = ABILITY_ELEMENTS[abilityId];
  const base = TIANYAN_LANDING_BASE_DAMAGE[
    abilityId as keyof typeof TIANYAN_LANDING_BASE_DAMAGE
  ];
  if (!element || base === undefined) return 0;
  const reaction = getTianyanReaction(seal, element);
  return base * (
    1 + (reaction.mainDamageBonus ?? reaction.followUpRatio ?? 0)
  );
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
    const prioritized = this.pickAvailable(context, priorities, score);
    if (prioritized) return prioritized;
    const fallback = context.candidates[0];
    return fallback
      ? { ability: fallback.ability, target: fallback.target, score: 100 }
      : null;
  }

  protected pickAvailable(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score: number,
  ): AbilitySelectionResult | null {
    const index = new SectStrategyCandidates(TIANYAN_SECT_ID, context.candidates);
    for (const id of priorities) {
      const result = index.result(id, score);
      if (result) return result;
    }
    return null;
  }

  protected lowestCostLanding(
    context: AbilitySelectionContext,
    score: number,
  ): AbilitySelectionResult | null {
    const candidate = context.candidates
      .filter((entry) => Boolean(ABILITY_ELEMENTS[contentAbilityId(entry.ability.id)]))
      .sort((left, right) =>
        left.ability.manaCost - right.ability.manaCost ||
        left.order - right.order ||
        left.ability.id.localeCompare(right.ability.id),
      )[0];
    return candidate
      ? { ability: candidate.ability, target: candidate.target, score }
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
        const recovery = this.pickAvailable(
          context,
          ['myriad-wood-renewal', 'boundless-earth'],
          760,
        );
        if (recovery) return recovery;
      }
      if (mp < 0.35) {
        const recovery = this.pickAvailable(
          context,
          [
            'heavenly-river-cleansing',
            ...(currentSeal(context) === 'water' ? ['five-qi-repository'] : []),
          ],
          750,
        );
        if (recovery) return recovery;
      }
    }
    if (this.tacticId === 'small-cycle') {
      if (reactions.length > 0) {
        const missingElementReactions = reactions.filter((id) => {
          const element = ABILITY_ELEMENTS[id];
          return element
            ? !context.caster.tags.hasTag(tianyanReactionElementMarkerTag(element))
            : false;
        });
        if (missingElementReactions.length > 0) {
          return this.pick(context, missingElementReactions, 740);
        }
      }
      if (!currentSeal(context)) {
        const landing = this.lowestCostLanding(context, 700);
        if (landing) return landing;
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
      const hasControlLanding = context.candidates.some((candidate) => {
        const id = contentAbilityId(candidate.ability.id);
        return id === 'earth-bearing-seal' ||
          id === 'metal-cloud-cutter' ||
          id === 'white-star-breaker';
      });
      if (currentSeal(context) && hasControlLanding) {
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
        const seal = currentSeal(context)!;
        const expectedDamageOrder = anyReaction
          .map((id, order) => ({
            id,
            order,
            damage: expectedReactionDamage(id, seal),
          }))
          .sort((left, right) =>
            right.damage - left.damage ||
            left.order - right.order ||
            left.id.localeCompare(right.id),
          )
          .map(({ id }) => id);
        return this.pick(
          context,
          expectedDamageOrder,
          760,
        );
      }
      const seal = currentSeal(context);
      if (seal) {
        const repositoryFirst =
          (seal === 'water' && context.caster.getMpPercent() < 0.35) ||
          (seal === 'wood' && context.caster.getHpPercent() < 0.60);
        return this.pick(
          context,
          repositoryFirst
            ? ['five-qi-repository', 'shift-palace', 'primordial-ray']
            : ['shift-palace', 'five-qi-repository', 'primordial-ray'],
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
