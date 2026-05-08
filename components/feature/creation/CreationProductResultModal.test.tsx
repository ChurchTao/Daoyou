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

jest.mock('@/components/feature/products', () => ({
  toProductDisplayModel: jest.fn((product) => product),
  getProductShowcaseProps: jest.fn(() => ({
    icon: '📜',
    name: '九霄雷引',
    description: '引九霄雷意化作神通真形。',
    footer: <div>原始词缀区</div>,
  })),
}));

const { CreationProductResultModal } = jest.requireActual(
  './CreationProductResultModal',
) as typeof import('./CreationProductResultModal');

describe('CreationProductResultModal', () => {
  it('应同时保留产物原始 footer 与额外操作 footer', () => {
    const markup = renderToStaticMarkup(
      <CreationProductResultModal
        isOpen
        onClose={() => {}}
        product={{
          id: 'skill-1',
          name: '九霄雷引',
          productType: 'skill',
          productModel: {},
        }}
        footer={<div>前往处理</div>}
      />,
    );

    expect(markup).toContain('九霄雷引');
    expect(markup).toContain('原始词缀区');
    expect(markup).toContain('前往处理');
  });

  it('缺少产物时不应渲染内容', () => {
    const markup = renderToStaticMarkup(
      <CreationProductResultModal
        isOpen
        onClose={() => {}}
        product={null}
      />,
    );

    expect(markup).toBe('');
  });
});
