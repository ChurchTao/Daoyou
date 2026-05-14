import {
  getProductShowcaseProps,
  toProductDisplayModel,
  type ProductRecordLike,
} from '@app/components/feature/products';
import { ItemShowcaseModal } from '@app/components/ui/ItemShowcaseModal';
import type { ReactNode } from 'react';

export interface CreationProductResultRecord extends ProductRecordLike {
  id?: string;
  needs_replace?: boolean;
  currentCount?: number;
  maxCount?: number;
}

interface CreationProductResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: CreationProductResultRecord | null;
  footer?: ReactNode;
}

export function CreationProductResultModal({
  isOpen,
  onClose,
  product,
  footer,
}: CreationProductResultModalProps) {
  if (!product) return null;

  const displayModel = toProductDisplayModel(product);
  const showcaseProps = getProductShowcaseProps(displayModel);
  const mergedFooter =
    footer || showcaseProps.footer ? (
      <div className="space-y-4">
        {showcaseProps.footer}
        {footer}
      </div>
    ) : undefined;

  return (
    <ItemShowcaseModal
      isOpen={isOpen}
      onClose={onClose}
      {...showcaseProps}
      footer={mergedFooter}
    />
  );
}
