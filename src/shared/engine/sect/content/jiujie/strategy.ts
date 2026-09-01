import type { AbilitySelectionContext } from '@shared/engine/battle-v5/abilities/AbilitySelectionStrategy';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { SectTacticalSelectionStrategy, type SectTacticId } from '../../core';
import {
  JIUJIE_CALAMITY,
  JIUJIE_DEBT,
  JIUJIE_EYE,
  JIUJIE_SECT_ID,
  JIUJIE_THUNDER,
} from './ids';

function layers(context: AbilitySelectionContext, id: string): number {
  return (
    context.opponent?.buffs
      .getAllBuffs()
      .find((buff) => buff.id === id)
      ?.getLayer() ?? 0
  );
}

function hasCasterBuff(context: AbilitySelectionContext, id: string): boolean {
  return context.caster.buffs.getAllBuffIds().includes(id);
}

function shouldSettle(
  context: AbilitySelectionContext,
  calamity: number,
  tacticId?: SectTacticId,
): boolean {
  const targetCanBeSettled =
    layers(context, JIUJIE_THUNDER) > 0 || layers(context, JIUJIE_DEBT) > 0;
  if (!targetCanBeSettled) return false;
  if (calamity >= 3) return true;
  if (
    calamity >= 2 &&
    (tacticId === 'bear-and-return' || tacticId === 'record-and-judge')
  ) return true;
  return calamity >= 2 && (
    context.caster.getHpPercent() <= 0.4 ||
    (context.opponent?.getHpPercent() ?? 1) <= 0.3
  );
}

abstract class Strategy extends SectTacticalSelectionStrategy {
  constructor(protected readonly tacticId: SectTacticId) {
    super(JIUJIE_SECT_ID);
  }

  protected pick(context: AbilitySelectionContext, ids: string[]) {
    for (const id of ids) {
      const result = this.firstAvailable(context, [id], 600);
      if (result) return this.cast(result);
    }
    return this.fallback();
  }
}

export class JiujieBaseSelectionStrategy extends Strategy {
  constructor() {
    super('base');
  }

  protected decide(context: AbilitySelectionContext) {
    const thunder = layers(context, JIUJIE_THUNDER);
    const calamity = context.caster.combatResources.getCurrent(JIUJIE_CALAMITY);

    if (shouldSettle(context, calamity)) {
      return this.pick(context, ['nine-sky-settlement', 'causal-echo']);
    }
    if (!thunder) {
      return this.pick(context, [
        'heaven-hearing',
        'calamity-seal',
        'thunder-finger',
      ]);
    }
    return this.pick(context, [
      'thunder-prison-question',
      'calamity-seal',
      'causal-echo',
      'thunder-finger',
    ]);
  }
}

export class JiujieEyeSelectionStrategy extends Strategy {
  protected decide(context: AbilitySelectionContext) {
    const thunder = layers(context, JIUJIE_THUNDER);
    const calamity = context.caster.combatResources.getCurrent(JIUJIE_CALAMITY);

    if (shouldSettle(context, calamity, this.tacticId)) {
      return this.pick(context, ['nine-sky-settlement', 'causal-echo']);
    }

    const receiving = hasCasterBuff(context, 'sect.jiujie.receive-calamity');
    const eyeOpen = hasCasterBuff(context, JIUJIE_EYE);
    if (!receiving || !eyeOpen) {
      return this.pick(context, [
        'receive-calamity',
        'heaven-hearing',
        'calamity-seal',
      ]);
    }

    if (!thunder) {
      return this.pick(context, [
        'heaven-hearing',
        'calamity-seal',
        'causal-echo',
        'thunder-finger',
      ]);
    }

    const needsEmergencyShield =
      this.tacticId === 'close-the-eye' &&
      calamity >= 1 &&
      context.caster.getHpPercent() <= 0.5 &&
      context.caster.getCurrentShield() <= 0;
    if (needsEmergencyShield) {
      return this.pick(context, [
        'borrow-calamity',
        'receive-calamity',
        'thunder-prison-question',
      ]);
    }

    if (this.tacticId === 'eye-of-thunder') {
      return this.pick(context, [
        'calamity-seal',
        'thunder-prison-question',
        'causal-echo',
        'thunder-finger',
      ]);
    }

    return this.pick(context, [
      'thunder-prison-question',
      'calamity-seal',
      'causal-echo',
      'thunder-finger',
    ]);
  }
}

export class JiujieCondemnationSelectionStrategy extends Strategy {
  protected decide(context: AbilitySelectionContext) {
    const thunder = layers(context, JIUJIE_THUNDER);
    const debt = layers(context, JIUJIE_DEBT);
    const calamity = context.caster.combatResources.getCurrent(JIUJIE_CALAMITY);

    if (this.tacticId === 'heavy-statute' && debt >= 3 && calamity < 3) {
      const echo = this.result(context, 'causal-echo', 700);
      if (
        echo?.ability.tags.hasTag(
          GameplayTags.ABILITY.SECT.mechanic(JIUJIE_SECT_ID, 'heavy-statute'),
        )
      ) {
        return this.cast(echo);
      }
    }

    if (shouldSettle(context, calamity, this.tacticId)) {
      return this.pick(context, ['nine-sky-settlement', 'causal-echo']);
    }

    if (!thunder) {
      return this.pick(context, ['heaven-hearing', 'calamity-seal']);
    }

    if (this.tacticId === 'heavy-statute') {
      return this.pick(context, [
        'calamity-seal',
        'thunder-prison-question',
        'causal-echo',
        'thunder-finger',
      ]);
    }
    if (this.tacticId === 'listen-to-heaven') {
      return this.pick(context, [
        'thunder-prison-question',
        'causal-echo',
        'calamity-seal',
        'thunder-finger',
      ]);
    }
    return this.pick(context, [
      'thunder-prison-question',
      'calamity-seal',
      'causal-echo',
      'thunder-finger',
    ]);
  }
}
