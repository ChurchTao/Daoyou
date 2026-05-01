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

const { ItemShowcaseModal } = jest.requireActual(
  './ItemShowcaseModal',
) as typeof import('./ItemShowcaseModal');

describe('ItemShowcaseModal', () => {
  it('应渲染能力详情新增插槽内容', () => {
    const markup = renderToStaticMarkup(
      <ItemShowcaseModal
        isOpen
        onClose={() => {}}
        icon="📜"
        name="焚邪破妄术"
        badges={[<span key="badge">「真品」神通</span>]}
        summary={<div>评分 88</div>}
        metaSection={<div>目标策略：敌方·单体</div>}
        extraInfo={<div>法力消耗 640</div>}
        description="以火狐尾焰引先天火气，出手时烈焰裹身。"
        footer={<div>词缀</div>}
      />,
    );

    expect(markup).toContain('焚邪破妄术');
    expect(markup).toContain('评分 88');
    expect(markup).toContain('目标策略：敌方·单体');
    expect(markup).toContain('法力消耗 640');
    expect(markup).toContain('词缀');
  });

  it('应保持材料和消耗品的基础展示不受影响', () => {
    const markup = renderToStaticMarkup(
      <ItemShowcaseModal
        isOpen
        onClose={() => {}}
        icon="🌕"
        name="回春丹"
        description="服之可温养气海，徐徐回气。"
      />,
    );

    expect(markup).toContain('回春丹');
    expect(markup).toContain('服之可温养气海');
  });
});
