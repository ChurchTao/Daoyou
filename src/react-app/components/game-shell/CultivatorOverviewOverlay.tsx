import { InkModal } from '@app/components/layout';
import { CultivatorOverviewPanel } from './CultivatorOverviewPanel';

export function CultivatorOverviewOverlay({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title="【道身总谱】"
      className="max-w-5xl p-5 md:p-6"
    >
      <CultivatorOverviewPanel />
    </InkModal>
  );
}
