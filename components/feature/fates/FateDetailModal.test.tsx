import { describe, expect, it, jest } from '@jest/globals';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

jest.mock('@/components/layout', () => ({
  InkModal: ({
    children,
    title,
    footer,
  }: {
    children: ReactNode;
    title?: ReactNode;
    footer?: ReactNode;
  }) => (
    <div data-mock-modal="true">
      {title ? <div>{title}</div> : null}
      <div>{children}</div>
      {footer ? <div>{footer}</div> : null}
    </div>
  ),
}));

const { FateDetailModal } = jest.requireActual(
  './FateDetailModal',
) as typeof import('./FateDetailModal');

describe('FateDetailModal', () => {
  it('应渲染命格标签与完整词条', () => {
    const markup = renderToStaticMarkup(
      <FateDetailModal
        isOpen
        onClose={() => {}}
        fate={{
          name: '剑锋命',
          quality: '天品',
          description: '锋芒入骨，命中常带攻伐之机。',
          tags: ['Material.Semantic.Blade', 'Material.Semantic.Metal'],
          effects: [
            {
              id: '1',
              fragmentId: 'boon_blade_resonance',
              scope: 'creation',
              polarity: 'boon',
              effectType: 'creation_tag_bias',
              value: 0.8,
              tags: ['Material.Semantic.Blade'],
              label: '造物更易引出【锋刃】词缀（极）',
              description: '造物更易引出【锋刃】词缀（极）',
              extreme: 'extreme',
            },
            {
              id: '2',
              fragmentId: 'burden_world_herb',
              scope: 'world',
              polarity: 'burden',
              effectType: 'reward_type_bias',
              value: 0.8,
              rewardTypes: ['herb'],
              label: '药材类机缘权重 -20%',
              description: '药材类机缘权重 -20%',
              extreme: 'strong',
            },
          ],
        }}
      />,
    );

    expect(markup).toContain('剑锋命');
    expect(markup).toContain('锋刃');
    expect(markup).toContain('金铁');
    expect(markup).toContain('造物偏置');
    expect(markup).toContain('代价反噬');
    expect(markup).toContain('药材类机缘权重 -20%');
  });
});
