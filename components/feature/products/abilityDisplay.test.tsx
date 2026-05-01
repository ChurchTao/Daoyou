import { describe, expect, it } from '@jest/globals';
import { renderToStaticMarkup } from 'react-dom/server';
import { AffixChip } from './AffixChip';
import { AffixInlineList } from './AffixInlineList';
import {
  formatTargetPolicy,
  formatTargetPolicyValue,
  type AffixView,
} from './abilityDisplay';

const baseAffix: AffixView = {
  id: 'affix-1',
  name: '灵力充沛',
  bodyText: '法力恢复略有提升',
  rarityTone: 'info',
  rarity: 'rare',
  isPerfect: false,
  tags: [],
};

describe('abilityDisplay', () => {
  it('应稳定格式化神通目标策略文案', () => {
    expect(
      formatTargetPolicy({
        team: 'enemy',
        scope: 'single',
      }),
    ).toBe('目标策略：敌方·单体');
    expect(
      formatTargetPolicy({
        team: 'enemy',
        scope: 'aoe',
        maxTargets: 3,
      }),
    ).toBe('目标策略：敌方·群体（最多 3）');
    expect(
      formatTargetPolicyValue({
        team: 'self',
        scope: 'single',
      }),
    ).toBe('自身');
  });

  it('AffixInlineList 应将多个词缀渲染为独立文本单元', () => {
    const markup = renderToStaticMarkup(
      <AffixInlineList
        affixes={[
          baseAffix,
          {
            ...baseAffix,
            id: 'affix-2',
            name: '水灵根强化',
            rarityTone: 'rare',
          },
        ]}
      />,
    );

    const tokenCount =
      markup.match(/data-affix-inline-token=/g)?.length ?? 0;

    expect(markup).toContain('词缀：');
    expect(markup).toContain('灵力充沛');
    expect(markup).toContain('水灵根强化');
    expect(tokenCount).toBe(2);
  });

  it('AffixChip 应将极标记内聚到词缀标题结构中', () => {
    const markup = renderToStaticMarkup(
      <ul>
        <AffixChip
          affix={{
            ...baseAffix,
            id: 'perfect-affix',
            name: '焚脉',
            isPerfect: true,
          }}
        />
      </ul>,
    );

    expect(markup).toContain('data-affix-perfect-mark="embedded"');
    expect(markup).not.toContain('bg-amber-100');
    expect(markup).toContain('焚脉');
  });
});
