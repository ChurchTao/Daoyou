import type {
  AbilitySelectionContext,
  AbilitySelectionResult,
  AbilitySelectionStrategy,
} from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { ActiveSkill } from '@shared/engine/battle-v5/abilities/ActiveSkill';
import { SectStrategyCandidates, type SectTacticId } from '../../core';
import {
  YOUDU_FORGETFUL_RIVER,
  YOUDU_SECT_ID,
  YOUDU_SHADOW_REVEALED,
  YOUDU_SOUL_EROSION,
  YOUDU_SOUL_FIRE,
} from './ids';

function layer(context: AbilitySelectionContext): number {
  return context.opponent?.buffs.getAllBuffs()
    .find((buff) => buff.id === YOUDU_SOUL_EROSION)?.getLayer() ?? 0;
}

function hasBuff(context: AbilitySelectionContext, id: string): boolean {
  return context.opponent?.buffs.getAllBuffIds().includes(id) ?? false;
}

function hasImminentHealing(context: AbilitySelectionContext): boolean {
  return context.opponent?.abilities.getAllAbilities().some(
    (ability) =>
      ability instanceof ActiveSkill &&
      ability.selectionProfile?.intents?.includes('heal_hp') &&
      ability.currentCooldown <= 1,
  ) ?? false;
}

function hasImminentControlOrHealing(
  context: AbilitySelectionContext,
): boolean {
  return context.opponent?.abilities.getAllAbilities().some(
    (ability) =>
      ability instanceof ActiveSkill &&
      ability.currentCooldown <= 1 &&
      (ability.selectionProfile?.intents?.includes('control') ||
        ability.selectionProfile?.intents?.includes('heal_hp')),
  ) ?? false;
}

abstract class YouduSelectionStrategy implements AbilitySelectionStrategy {
  constructor(protected readonly tacticId: SectTacticId) {}
  abstract select(context: AbilitySelectionContext): AbilitySelectionResult | null;

  protected pick(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score = 600,
  ): AbilitySelectionResult | null {
    const index = new SectStrategyCandidates(YOUDU_SECT_ID, context.candidates);
    for (const id of priorities) {
      const result = index.result(id, score);
      if (result) return result;
    }
    const fallback = context.candidates[0];
    return fallback
      ? { ability: fallback.ability, target: fallback.target, score: 100 }
      : null;
  }

  protected pickOnly(
    context: AbilitySelectionContext,
    priorities: readonly string[],
    score = 600,
  ): AbilitySelectionResult | null {
    const index = new SectStrategyCandidates(YOUDU_SECT_ID, context.candidates);
    for (const id of priorities) {
      const result = index.result(id, score);
      if (result) return result;
    }
    return null;
  }
}

export class YouduTideSelectionStrategy extends YouduSelectionStrategy {
  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const erosion = layer(context);
    const hasForget = hasBuff(context, YOUDU_FORGETFUL_RIVER);
    const fire = context.caster.combatResources.getCurrent(YOUDU_SOUL_FIRE);
    const targetHp = context.opponent?.getHpPercent() ?? 1;

    if (!hasForget) {
      return this.pick(context, ['forgetful-river-tide', 'soul-severing-call', 'one-sigh'], 780);
    }
    if (erosion < 3) {
      return this.pick(context, ['soul-severing-call', 'seize-soul', 'one-sigh'], 740);
    }
    if (this.tacticId === 'healer-drown' && hasImminentHealing(context)) {
      return this.pick(
        context,
        ['pin-soul', 'seize-soul', 'soul-severing-call'],
        760,
      );
    }
    if (this.tacticId === 'long-night') {
      if (erosion >= 4 && (fire >= 3 || targetHp < 0.30)) {
        return this.pick(context, ['soul-shall-not-return', 'pin-soul'], 790);
      }
      if (erosion >= 4) {
        return this.pickOnly(context, ['reveal-shadow'], 720);
      }
      return this.pick(context, ['pin-soul', 'one-sigh', 'seize-soul'], 710);
    }
    if (erosion >= 4 && (targetHp < 0.45 || fire >= 3)) {
      return this.pick(context, ['soul-shall-not-return', 'pin-soul'], 790);
    }
    return this.pick(context, ['soul-severing-call', 'seize-soul', 'one-sigh']);
  }
}

export class YouduDecreeSelectionStrategy extends YouduSelectionStrategy {
  select(context: AbilitySelectionContext): AbilitySelectionResult | null {
    const erosion = layer(context);
    const hasShadow = hasBuff(context, YOUDU_SHADOW_REVEALED);
    const fire = context.caster.combatResources.getCurrent(YOUDU_SOUL_FIRE);
    const targetHp = context.opponent?.getHpPercent() ?? 1;

    if (this.tacticId === 'pin-the-caster') {
      if (!hasShadow) {
        return this.pick(context, ['reveal-shadow', 'soul-severing-call'], 800);
      }
      if (hasImminentControlOrHealing(context)) {
        return this.pick(context, ['pin-soul', 'soul-severing-call'], 810);
      }
      if (erosion >= 4 && (fire >= 3 || targetHp < 0.45)) {
        return this.pick(context, ['soul-shall-not-return', 'pin-soul'], 820);
      }
    }
    if (this.tacticId === 'judge-at-four' && erosion >= 4) {
      return this.pick(context, ['soul-shall-not-return', 'pin-soul'], 820);
    }
    if (this.tacticId === 'take-the-fifth') {
      if (erosion < 5) {
        return this.pick(context, ['soul-severing-call', 'seize-soul', 'pin-soul', 'one-sigh'], 760);
      }
      return this.pick(context, ['pin-soul', 'soul-shall-not-return'], 700);
    }
    if (erosion >= 4) {
      return this.pick(
        context,
        fire >= 3
          ? ['soul-shall-not-return', 'pin-soul']
          : ['pin-soul', 'soul-shall-not-return'],
        790,
      );
    }
    return this.pick(context, ['soul-severing-call', 'seize-soul', 'one-sigh']);
  }
}
