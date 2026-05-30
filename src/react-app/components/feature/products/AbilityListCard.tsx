import { ItemCard } from '@app/components/ui/ItemCard';
import { InkBadge } from '@app/components/ui/InkBadge';
import type { ReactNode } from 'react';
import { AbilityMetaLine } from './AbilityMetaLine';
import { AffixInlineList } from './AffixInlineList';
import type { ProductDisplayModel } from './abilityDisplay';

export interface AbilityListCardProps {
  product: ProductDisplayModel;
  actions?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  extraBadges?: ReactNode;
}

function getAbilityIcon(product: ProductDisplayModel): string {
  if (product.productType === 'gongfa') {
    return '📘';
  }

  if (product.productType === 'skill') {
    return '📜';
  }

  return '🗡️';
}

export function AbilityListCard({
  product,
  actions,
  selected = false,
  onSelect,
  extraBadges,
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
  const card = (
    <ItemCard
      icon={getAbilityIcon(product)}
      name={product.name}
      quality={product.quality}
      badgeExtra={
        <>
          {product.element ? (
            <InkBadge tone="default">{product.element}</InkBadge>
          ) : null}
          {extraBadges}
        </>
      }
      meta={meta}
      description={product.description}
      actions={
        actions ? (
          onSelect ? (
            <div
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {actions}
            </div>
          ) : (
            actions
          )
        ) : undefined
      }
      highlight={selected}
      layout="col"
    />
  );

  if (!onSelect) {
    return card;
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      className="w-full cursor-pointer text-left"
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      {card}
    </div>
  );
}
