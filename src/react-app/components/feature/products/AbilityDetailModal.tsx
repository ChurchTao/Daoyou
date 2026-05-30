import { ItemShowcaseModal } from '@app/components/ui/ItemShowcaseModal';
import { getProductShowcaseProps } from './productShowcase';
import type { ProductDisplayModel } from './abilityDisplay';

export interface AbilityDetailModalProps {
  product: ProductDisplayModel | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AbilityDetailModal({
  product,
  isOpen,
  onClose,
}: AbilityDetailModalProps) {
  if (!product) return null;

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      {...getProductShowcaseProps(product)}
    />
  );
}
