import { getGameConceptIcon } from '@shared/lib/gameConceptDisplay';
import type { ReactNode } from 'react';
import { AbilityMetaLine } from './AbilityMetaLine';
import { AffixInlineList } from './AffixInlineList';
import type { ProductDisplayModel } from './abilityDisplay';
import { ProductListRow } from './ProductListRow';

export interface AbilityListCardProps {
  product: ProductDisplayModel;
  actions?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  extraBadges?: ReactNode;
  variant?: 'normal' | 'pending';
}

function getAbilityIcon(product: ProductDisplayModel): string {
  if (product.productType === 'gongfa') {
    return getGameConceptIcon('gongfa');
  }

  if (product.productType === 'skill') {
    return getGameConceptIcon('skill');
  }

  return getGameConceptIcon('artifact');
}

export function AbilityListCard({
  product,
  actions,
  selected = false,
  onSelect,
  variant = 'normal',
}: AbilityListCardProps) {
  const affixMeta =
    product.affixes.length > 0 ? <AffixInlineList affixes={product.affixes} /> : null;
  const projectionMeta =
    product.productType === 'skill' ? (
      <AbilityMetaLine projection={product.projection} />
    ) : null;
  const meta =
    affixMeta || projectionMeta ? (
      <div className="space-y-1">
        {affixMeta}
        {projectionMeta}
      </div>
    ) : undefined;
  const state = selected
    ? 'selected'
    : variant === 'pending'
      ? 'pending'
      : product.isEquipped
        ? 'active'
        : 'normal';
  const stateLabel = selected
    ? '已选中'
    : variant === 'pending'
      ? '待纳入'
      : product.isEquipped
        ? '已启用'
        : undefined;

  return (
    <ProductListRow
      icon={getAbilityIcon(product)}
      name={product.name}
      quality={product.quality}
      element={product.element}
      score={product.score}
      state={state}
      stateLabel={stateLabel}
      meta={meta}
      description={product.description}
      actions={actions}
      selected={selected}
      onSelect={onSelect}
    />
  );
}
