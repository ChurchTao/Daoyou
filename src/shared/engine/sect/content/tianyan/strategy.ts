import type {
  AbilitySelectionCandidate,
  AbilitySelectionContext,
  AbilitySelectionResult,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { BuffType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  SectStrategyCandidates,
  SectTacticalSelectionStrategy,
  type SectTacticId,
} from '../../core';
import { TIANYAN_SECT_ID } from './ids';
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
  return runtimeId.startsWith(prefix)
    ? runtimeId.slice(prefix.length)
    : runtimeId;
}

function hasDispellableBuff(context: AbilitySelectionContext): boolean {
  return (
    context.opponent?.buffs
      .getAllBuffs()
      .some(
        (buff) =>
          buff.type === BuffType.BUFF &&
          buff.countsAsStatus &&
          buff.dispelPolicy === 'normal',
      ) ?? false
  );
}

function hasCleanseableDebuff(context: AbilitySelectionContext): boolean {
  return context.caster.buffs
    .getAllBuffs()
    .some(
      (buff) =>
        buff.type !== BuffType.BUFF &&
        buff.countsAsStatus &&
        buff.dispelPolicy === 'normal',
    );
}

function currentSeal(
  context: AbilitySelectionContext,
): TianyanElement | undefined {
  const target = context.opponent;
  if (!target) return undefined;
  return TIANYAN_ELEMENTS.find((element) =>
    target.tags.hasTag(TIANYAN_SEAL_STATE_TAGS[element]),
  );
}

function currentSealSlot(
  context: AbilitySelectionContext,
  seal: TianyanElement,
): number | undefined {
  const activeAbilities = context.caster.abilities
    .getAllAbilities()
    .filter(
      (ability): ability is ActiveSkill => ability instanceof ActiveSkill,
    );
  const mountedOrder = activeAbilities.findIndex(
    (ability) => ABILITY_ELEMENTS[contentAbilityId(ability.id)] === seal,
  );
  if (mountedOrder >= 0) return mountedOrder;

  return context.candidates.find(
    (candidate) =>
      ABILITY_ELEMENTS[contentAbilityId(candidate.ability.id)] === seal,
  )?.order;
}

function compareCircularSlotOrder(
  context: AbilitySelectionContext,
  seal: TianyanElement,
  left: AbilitySelectionCandidate,
  right: AbilitySelectionCandidate,
): number {
  const sealOrder = currentSealSlot(context, seal);
  if (sealOrder === undefined) {
    return (
      left.order - right.order ||
      left.ability.id.localeCompare(right.ability.id)
    );
  }

  const leftWrapped = left.order <= sealOrder;
  const rightWrapped = right.order <= sealOrder;
  return (
    Number(leftWrapped) - Number(rightWrapped) ||
    left.order - right.order ||
    left.ability.id.localeCompare(right.ability.id)
  );
}

function abilityIdsByReaction(
  context: AbilitySelectionContext,
  kind: 'generation' | 'overcoming' | 'any',
  circular = false,
): string[] {
  const seal = currentSeal(context);
  if (!seal) return [];
  const candidates = circular
    ? [...context.candidates].sort((left, right) =>
        compareCircularSlotOrder(context, seal, left, right),
      )
    : context.candidates;
  return candidates
    .map((candidate) => {
      const id = contentAbilityId(candidate.ability.id);
      const element = ABILITY_ELEMENTS[id];
      if (!element) return undefined;
      const reaction = getTianyanReaction(seal, element);
      if (reaction.kind !== 'generation' && reaction.kind !== 'overcoming')
        return undefined;
      return kind === 'any' || reaction.kind === kind ? id : undefined;
    })
    .filter((id): id is string => Boolean(id));
}

function reactionCandidates(context: AbilitySelectionContext): Array<
  AbilitySelectionCandidate & {
    id: string;
    element: TianyanElement;
  }
> {
  const seal = currentSeal(context);
  if (!seal) return [];
  return context.candidates.flatMap((candidate) => {
    const id = contentAbilityId(candidate.ability.id);
    const element = ABILITY_ELEMENTS[id];
    if (!element) return [];
    const reaction = getTianyanReaction(seal, element);
    return reaction.kind === 'generation' || reaction.kind === 'overcoming'
      ? [{ ...candidate, id, element }]
      : [];
  });
}

function expectedReactionDamage(
  abilityId: string,
  seal: TianyanElement,
): number {
  const element = ABILITY_ELEMENTS[abilityId];
  const base =
    TIANYAN_LANDING_BASE_DAMAGE[
      abilityId as keyof typeof TIANYAN_LANDING_BASE_DAMAGE
    ];
  if (!element || base === undefined) return 0;
  const reaction = getTianyanReaction(seal, element);
  return base * (1 + (reaction.mainDamageBonus ?? reaction.followUpRatio ?? 0));
}

abstract class TianyanSelectionStrategy extends SectTacticalSelectionStrategy {
  constructor(protected readonly tacticId: SectTacticId) {
    super(TIANYAN_SECT_ID);
  }

  protected pick(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score = 600,
  ) {
    const prioritized = this.pickAvailable(context, priorities, score);
    return prioritized ? this.cast(prioritized) : this.fallback();
  }

  protected pickAvailable(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score: number,
  ): AbilitySelectionResult | null {
    const index = new SectStrategyCandidates(
      TIANYAN_SECT_ID,
      context.candidates,
    );
    for (const id of priorities) {
      const result = index.result(id, score);
      if (result) return result;
    }
    return null;
  }

  protected firstLanding(
    context: AbilitySelectionContext,
    score: number,
  ): AbilitySelectionResult | null {
    const candidate = context.candidates
      .filter((entry) =>
        Boolean(ABILITY_ELEMENTS[contentAbilityId(entry.ability.id)]),
      )
      .sort(
        (left, right) =>
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
    circular = false,
  ): string[] {
    return abilityIdsByReaction(context, kind, circular);
  }

  protected cleanse(context: AbilitySelectionContext) {
    return hasCleanseableDebuff(context)
      ? this.pickAvailable(context, ['lotus-in-fire'], 820)
      : null;
  }
}

export class TianyanBaseSelectionStrategy extends TianyanSelectionStrategy {
  constructor() {
    super('base');
  }

  protected decide(context: AbilitySelectionContext) {
    const hp = context.caster.getHpPercent();
    const mp = context.caster.getMpPercent();
    const seal = currentSeal(context);
    const cleanse = this.cleanse(context);
    if (cleanse) return this.cast(cleanse);

    if (hp < 0.6) {
      const recovery = this.pickAvailable(
        context,
        [
          'myriad-wood-renewal',
          ...(context.caster.getCurrentShield() <= 0
            ? ['boundless-earth']
            : []),
        ],
        800,
      );
      if (recovery) return this.cast(recovery);
    }

    if (mp < 0.35) {
      const recovery = this.pickAvailable(
        context,
        [
          'heavenly-river-cleansing',
          ...(seal === 'water' ? ['five-qi-repository'] : []),
        ],
        780,
      );
      if (recovery) return this.cast(recovery);
    }

    if (seal) {
      const reactions = reactionCandidates(context).sort((left, right) => {
        const leftUsed = context.caster.tags.hasTag(
          tianyanReactionElementMarkerTag(left.element),
        );
        const rightUsed = context.caster.tags.hasTag(
          tianyanReactionElementMarkerTag(right.element),
        );
        return (
          Number(leftUsed) - Number(rightUsed) ||
          compareCircularSlotOrder(context, seal, left, right)
        );
      });
      const reaction = reactions[0];
      if (reaction) {
        return this.cast({
          ability: reaction.ability,
          target: reaction.target,
          score: 760,
        });
      }

      const shift = this.pickAvailable(context, ['shift-palace'], 700);
      return shift ? this.cast(shift) : this.defaultAttack();
    }

    const landing = this.firstLanding(context, 700);
    return landing ? this.cast(landing) : this.fallback();
  }
}

export class HetuSelectionStrategy extends TianyanSelectionStrategy {
  protected decide(context: AbilitySelectionContext) {
    const hp = context.caster.getHpPercent();
    const mp = context.caster.getMpPercent();
    const reactions = this.reactionPriorities(
      context,
      'any',
      this.tacticId === 'small-cycle',
    );
    const cleanse = this.cleanse(context);
    if (cleanse) return this.cast(cleanse);
    if (this.tacticId === 'nourish-origin') {
      if (hp < 0.6) {
        const recovery = this.pickAvailable(
          context,
          ['myriad-wood-renewal', 'boundless-earth'],
          760,
        );
        if (recovery) return this.cast(recovery);
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
        if (recovery) return this.cast(recovery);
      }
    }
    if (this.tacticId === 'small-cycle') {
      if (reactions.length > 0) {
        const missingElementReactions = reactions.filter((id) => {
          const element = ABILITY_ELEMENTS[id];
          return element
            ? !context.caster.tags.hasTag(
                tianyanReactionElementMarkerTag(element),
              )
            : false;
        });
        if (missingElementReactions.length > 0) {
          return this.pick(context, missingElementReactions, 740);
        }
      }
      if (!currentSeal(context)) {
        const landing = this.firstLanding(context, 700);
        if (landing) return this.cast(landing);
      }
    }
    if (
      this.tacticId === 'unbroken-flow' &&
      currentSeal(context) &&
      reactions.length === 0
    ) {
      const shift = this.pickAvailable(context, ['shift-palace'], 740);
      return shift ? this.cast(shift) : this.defaultAttack();
    }
    if (reactions.length > 0) return this.pick(context, reactions, 720);
    return this.pick(context, [
      'verdant-pulse',
      'earth-bearing-seal',
      'dark-water-return',
      'flowing-flame',
    ]);
  }
}

export class LuoshuSelectionStrategy extends TianyanSelectionStrategy {
  protected decide(context: AbilitySelectionContext) {
    const overcoming = this.reactionPriorities(context, 'overcoming');
    const anyReaction = this.reactionPriorities(context, 'any');
    const cleanse = this.cleanse(context);
    if (cleanse) return this.cast(cleanse);
    if (this.tacticId === 'lock-meridian') {
      const controlImmune =
        context.opponent?.tags.hasTag(GameplayTags.STATUS.IMMUNE.CONTROL) ??
        false;
      const lock = overcoming.filter(
        (id) =>
          id === 'white-star-breaker' ||
          id === 'metal-cloud-cutter' ||
          id === 'earth-bearing-seal',
      );
      if (!controlImmune && lock.length > 0)
        return this.pick(context, lock, 780);
      const hasControlLanding = context.candidates.some((candidate) => {
        const id = contentAbilityId(candidate.ability.id);
        return (
          id === 'earth-bearing-seal' ||
          id === 'metal-cloud-cutter' ||
          id === 'white-star-breaker'
        );
      });
      if (currentSeal(context) && hasControlLanding) {
        return this.pick(context, ['shift-palace', ...anyReaction], 720);
      }
    }
    if (this.tacticId === 'break-pattern') {
      if (overcoming.length > 0) {
        const priorities =
          hasDispellableBuff(context) &&
          overcoming.includes('white-star-breaker')
            ? ['white-star-breaker', ...overcoming]
            : overcoming;
        return this.pick(context, priorities, 760);
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
          .sort(
            (left, right) =>
              right.damage - left.damage ||
              left.order - right.order ||
              left.id.localeCompare(right.id),
          )
          .map(({ id }) => id);
        return this.pick(context, expectedDamageOrder, 760);
      }
      const seal = currentSeal(context);
      if (seal) {
        const repositoryFirst =
          (seal === 'water' && context.caster.getMpPercent() < 0.35) ||
          (seal === 'wood' && context.caster.getHpPercent() < 0.6);
        const recovery = this.pickAvailable(
          context,
          repositoryFirst
            ? ['five-qi-repository', 'shift-palace']
            : ['shift-palace', 'five-qi-repository'],
          700,
        );
        return recovery ? this.cast(recovery) : this.defaultAttack();
      }
    }
    return this.pick(context, [
      ...overcoming,
      ...anyReaction,
      'metal-cloud-cutter',
      'flowing-flame',
    ]);
  }
}
