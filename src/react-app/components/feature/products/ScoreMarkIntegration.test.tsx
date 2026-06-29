import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ArtifactListCard } from './ArtifactListCard';
import { AbilityListCard } from './AbilityListCard';
import { getProductShowcaseProps } from './productShowcase';
import type { ProductDisplayModel } from './abilityDisplay';

function createProduct(
  overrides: Partial<ProductDisplayModel> = {},
): ProductDisplayModel {
  return {
    name: '赤炎术',
    productType: 'skill',
    quality: '玄品',
    element: '火',
    score: 1280,
    affixes: [],
    modifiers: [],
    description: '引火成术。',
    ...overrides,
  };
}

describe('score mark integration', () => {
  it('renders ability rows with clean identity, element meta, and inline score', () => {
    const html = renderToStaticMarkup(
      <AbilityListCard product={createProduct()} />,
    );

    expect(html).toContain('data-product-list-row');
    expect(html).toContain('「玄品」');
    expect(html).toContain('font-bold');
    expect(html).toContain('text-base');
    expect(html).toContain('🔥');
    expect(html).toContain('火');
    expect(html).not.toContain('「火」');
    expect(html).toContain('data-score-mark');
    expect(html).toContain('评分 1280');
    expect(html).not.toContain('pr-16');
    expect(html).not.toContain('text-[');
  });

  it('hides the score mark when product score is missing or zero', () => {
    const html = renderToStaticMarkup(
      <AbilityListCard product={createProduct({ score: 0 })} />,
    );

    expect(html).not.toContain('data-score-mark');
    expect(html).not.toContain('评分 0');
  });

  it('renders artifact rows without repeating slot wording', () => {
    const html = renderToStaticMarkup(
      <ArtifactListCard
        artifact={{
          id: 'artifact-1',
          name: '辟火甲',
          slot: 'armor',
          element: '火',
          quality: '玄品',
          score: 960,
          description: '护身法甲。',
        }}
      />,
    );

    expect(html).toContain('data-score-mark');
    expect(html).toContain('评分 960');
    expect(html).toContain('🛡️');
    expect(html).not.toContain('护身法宝');
    expect(html).not.toContain('pr-16');
  });

  it('expresses active, selected, pending, and equipped states without visible status text', () => {
    const active = renderToStaticMarkup(
      <AbilityListCard product={createProduct({ isEquipped: true })} />,
    );
    const selected = renderToStaticMarkup(
      <AbilityListCard product={createProduct()} selected />,
    );
    const pending = renderToStaticMarkup(
      <AbilityListCard product={createProduct()} variant="pending" />,
    );
    const equipped = renderToStaticMarkup(
      <ArtifactListCard
        equipped
        artifact={{
          id: 'artifact-1',
          name: '辟火甲',
          slot: 'armor',
          element: '火',
          quality: '玄品',
          score: 960,
          description: '护身法甲。',
        }}
      />,
    );

    expect(active).toContain('data-product-row-state="active"');
    expect(active).not.toContain('>已启用<');
    expect(selected).toContain('data-product-row-state="selected"');
    expect(selected).not.toContain('>已选舍弃<');
    expect(pending).toContain('data-product-row-state="pending"');
    expect(pending).not.toContain('>待纳入道基<');
    expect(equipped).toContain('data-product-row-state="active"');
    expect(equipped).not.toContain('>已装备<');
  });

  it('provides score corner meta for product showcase modals', () => {
    const props = getProductShowcaseProps(createProduct({ score: 1560 }));
    const html = renderToStaticMarkup(<>{props.cornerMeta}</>);

    expect(html).toContain('data-score-mark');
    expect(html).toContain('评分 1560');
  });

  it('omits showcase score corner meta for unscored products', () => {
    const props = getProductShowcaseProps(createProduct({ score: 0 }));

    expect(props.cornerMeta).toBeUndefined();
  });
});
