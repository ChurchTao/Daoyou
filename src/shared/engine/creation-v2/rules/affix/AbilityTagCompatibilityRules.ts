import {
  GameplayTags,
  type DamageChannel,
} from '@shared/engine/shared/tag-domain';
import { AFFIX_STOP_REASONS } from '../../types';
import { Rule } from '../core';
import { AffixSelectionDecision, AffixSelectionFacts } from '../contracts';

/*
 * AbilityTagCompatibilityRules: 在词缀抽选阶段过滤会生成非法能力标签组合的候选。
 */
export class AbilityTagCompatibilityRules
  implements Rule<AffixSelectionFacts, AffixSelectionDecision>
{
  readonly id = 'affix.selection.ability-tag-compatibility';

  apply({ facts, decision }: Parameters<Rule<AffixSelectionFacts, AffixSelectionDecision>['apply']>[0]): void {
    if (facts.productType !== 'skill') {
      decision.trace.push({
        ruleId: this.id,
        outcome: 'applied',
        message: '非技能产物，跳过 ability tag 兼容性过滤',
      });
      return;
    }

    const selectedDamageChannel = this.getExclusiveDamageChannel(
      facts.selectedAbilityTags ?? [],
    );
    if (!selectedDamageChannel) {
      decision.trace.push({
        ruleId: this.id,
        outcome: 'applied',
        message: '尚未选中伤害频道，跳过 ability tag 兼容性过滤',
      });
      return;
    }

    const accepted = [] as AffixSelectionDecision['candidatePool'];

    for (const candidate of decision.candidatePool) {
      const candidateTags = candidate.grantedAbilityTags ?? [];
      const candidateDamageChannel =
        this.getExclusiveDamageChannel(candidateTags);
      if (!candidateDamageChannel) {
        accepted.push(candidate);
        continue;
      }

      if (candidateDamageChannel !== selectedDamageChannel) {
        decision.rejections.push({
          affixId: candidate.id,
          amount: candidate.energyCost,
          reason: AFFIX_STOP_REASONS.ABILITY_TAG_CONFLICT,
          ...(candidate.exclusiveGroup
            ? { exclusiveGroup: candidate.exclusiveGroup }
            : {}),
        });
        decision.trace.push({
          ruleId: this.id,
          outcome: 'blocked',
          message: '词缀因技能伤害频道冲突被过滤',
          details: {
            affixId: candidate.id,
            selectedDamageChannel,
            candidateDamageChannel,
          },
        });
        continue;
      }

      accepted.push(candidate);
    }

    decision.candidatePool = accepted;

    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: `ability tag 兼容性过滤完成：${accepted.length} 个词缀通过`,
      details: {
        selectedDamageChannel,
      },
    });
  }

  private getExclusiveDamageChannel(tags: string[]): DamageChannel | undefined {
    if (tags.includes(GameplayTags.ABILITY.CHANNEL.MAGIC)) {
      return GameplayTags.ABILITY.CHANNEL.MAGIC;
    }
    if (tags.includes(GameplayTags.ABILITY.CHANNEL.PHYSICAL)) {
      return GameplayTags.ABILITY.CHANNEL.PHYSICAL;
    }
    return undefined;
  }
}
