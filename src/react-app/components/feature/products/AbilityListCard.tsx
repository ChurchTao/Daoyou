import { getGameConceptIcon } from '@shared/lib/gameConceptDisplay';
import type { ReactNode } from 'react';
import type { ProductDisplayModel } from './abilityDisplay';
import { AffixInlineList } from './AffixInlineList';
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
    product.affixes.length > 0 ? (
      <AffixInlineList affixes={product.affixes} />
    ) : null;
  const meta = affixMeta;
  const state = selected
    ? 'selected'
    : variant === 'pending'
      ? 'pending'
      : 'normal';
  const stateLabel = selected
    ? '已选中'
    : variant === 'pending'
      ? '待纳入'
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
