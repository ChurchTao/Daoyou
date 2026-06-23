import {
  DEFAULT_AFFIX_REGISTRY,
  flattenAffixMatcherTags,
} from '@shared/engine/creation-v2/affixes';
import type { AffixDefinition } from '@shared/engine/creation-v2/affixes/types';
import type { RolledAffix } from '@shared/engine/creation-v2/types';
import { renderAffixMechanic } from './index';
import { describe, expect, it } from 'vitest';

function toRolledAffix(def: AffixDefinition): RolledAffix {
  return {
    id: def.id,
    name: def.displayName,
    description: def.displayDescription,
    category: def.category,
    match: def.match,
    tags: flattenAffixMatcherTags(def.match),
    grantedAbilityTags: def.grantedAbilityTags,
    weight: def.weight,
    energyCost: def.energyCost,
    exclusiveGroup: def.exclusiveGroup,
    applicableArtifactSlots: def.applicableArtifactSlots,
    targetPolicyConstraint: def.targetPolicyConstraint,
    selectionMeta: def.selectionMeta,
    effectTemplate: def.effectTemplate,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
  };
}

function renderAffix(affixId: string) {
  const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
  if (!def) throw new Error(`missing test affix: ${affixId}`);
  const affix = toRolledAffix(def);

  return renderAffixMechanic(affix, '凡品', {
    abilityTags: def.grantedAbilityTags,
  });
}

describe('affixText mechanic rendering', () => {
  it('renders elemental active damage with damage channel', () => {
    const view = renderAffix('skill-core-damage-fire');

    expect(view.effectText).toContain('火系法术伤害');
    expect(view.bodyText).not.toMatch(/Ability\./);
  });

  it('renders true damage without leaking runtime tags', () => {
    const view = renderAffix('skill-rare-soul-rend');

    expect(view.effectText).toContain('真实伤害');
    expect(view.tagLabels).toContain('真实');
    expect(view.tagLabels.join('、')).not.toMatch(/Ability\./);
  });

  it('expands dot buff details', () => {
    const view = renderAffix('skill-variant-burn-dot');

    expect(view.buffDetails[0]).toMatchObject({
      name: '灼烧',
      typeText: '负面状态',
    });
    expect(view.buffDetails[0].listenerTexts.join('、')).toContain(
      '持续伤害（DOT）',
    );
    expect(view.mechanicNotes.join('、')).toContain('DOT');
    expect(view.bodyText).toContain('60%概率附加「灼烧」');
    expect(view.bodyText).toContain('3回合');
    expect(view.bodyText).toContain('行动前造成');
    expect(view.bodyText).toContain('持续伤害（DOT）');
    expect(view.bodyText).toContain('按层数放大');
  });

  it('deduplicates elemental damage modifier phrasing', () => {
    const view = renderAffix('gongfa-school-fire-spec');

    expect(view.bodyText).toContain('造成火系伤害时');
    expect(view.bodyText).toContain('提升造成的伤害');
    expect(view.bodyText).not.toContain('造成伤害时 造成火系伤害时');
  });

  it('renders elemental damage reduction from target perspective', () => {
    const view = renderAffix('artifact-defense-fire-resist');

    expect(view.bodyText).toContain('受到火系伤害时');
    expect(view.bodyText).toContain('降低受到的伤害');
  });

  it('renders status tag trigger labels in Chinese', () => {
    const view = renderAffix('skill-rare-ignite');

    expect(view.effectText).toContain('灼烧');
    expect(view.effectText).not.toMatch(/Status\./);
  });

  it('renders recursive advanced effect details instead of placeholder counts', () => {
    const frostBurial = renderAffix('skill-rare-frost-burial');
    expect(frostBurial.bodyText).toContain('消耗');
    expect(frostBurial.bodyText).toContain('造成');
    expect(frostBurial.bodyText).toContain('真实');
    expect(frostBurial.bodyText).not.toContain('触发 2 段效果');

    const borrowedLaw = renderAffix('gongfa-school-borrowed-law-returned');
    expect(borrowedLaw.bodyText).toContain('记录治疗量');
    expect(borrowedLaw.bodyText).toContain('附加记录值');
    expect(borrowedLaw.bodyText).not.toContain('依次触发');
  });

  it('renders advanced event listener prefixes for planned passive affixes', () => {
    expect(renderAffix('gongfa-secret-leakless-body').bodyText).toContain(
      '抵抗控制时',
    );
    expect(renderAffix('gongfa-secret-void-step').bodyText).toContain('闪避时');
    expect(renderAffix('artifact-treasure-returning-ruin-pearl').bodyText).toContain(
      '护盾破裂时',
    );
  });

  it('renders lethal-only condition for calamity coin', () => {
    expect(renderAffix('artifact-treasure-calamity-coin').bodyText).toContain(
      '受到致命伤时',
    );
  });

  it('renders all planned advanced affixes without raw tags or placeholder text', () => {
    const plannedAffixIds = [
      'skill-rare-life-for-fire',
      'skill-rare-frost-burial',
      'skill-variant-thunder-pact',
      'skill-rare-poison-gu-return',
      'skill-rare-blood-ink-talisman',
      'skill-variant-wind-exchange-step',
      'skill-variant-cut-meridian',
      'skill-rare-old-dream-rekindle',
      'gongfa-secret-causality-scripture',
      'gongfa-secret-myriad-unity',
      'gongfa-school-reverse-cultivation',
      'gongfa-secret-three-breath-sword',
      'gongfa-secret-heaven-jealous-root',
      'gongfa-secret-leakless-body',
      'gongfa-secret-void-step',
      'gongfa-school-borrowed-law-returned',
      'artifact-treasure-karma-mirror',
      'artifact-treasure-calamity-coin',
      'artifact-treasure-thunder-devour-bottle',
      'artifact-defense-soul-purifying-bell',
      'artifact-treasure-taixu-robe',
      'artifact-defense-demon-locking-nail',
      'artifact-treasure-returning-ruin-pearl',
      'artifact-treasure-steal-heaven-seal',
    ];

    for (const affixId of plannedAffixIds) {
      const view = renderAffix(affixId);
      const text = [
        view.bodyText,
        view.effectText,
        ...view.conditionTexts,
        ...view.tagLabels,
        ...view.mechanicNotes,
      ].join(' ');

      expect(view.bodyText, affixId).not.toBe('');
      expect(text, affixId).not.toMatch(/Ability\.|Status\.|Buff\./);
      expect(text, affixId).not.toMatch(/undefined|NaN/);
      expect(text, affixId).not.toMatch(/触发 \d+ 段效果|依次触发/);
    }
  });
});
