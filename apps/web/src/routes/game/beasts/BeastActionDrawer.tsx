import { InkModal } from '@app/components/layout/InkModal';
import { InkButton } from '@app/components/ui/InkButton';
import type { SummonedBeast } from '@daoyou/game-domain/beasts';

export type BeastAction = 'release' | 'rest';
export function BeastActionDrawer({
  beast,
  pending,
  close,
  confirm,
}: {
  beast: SummonedBeast;
  pending: boolean;
  close: () => void;
  confirm: () => void;
}) {
  return (
    <InkModal
      isOpen
      title={`放生 · ${beast.name}`}
      onClose={close}
      footer={
        <div className="flex justify-end gap-3">
          <InkButton variant="secondary" disabled={pending} onClick={close}>
            取消
          </InkButton>
          <InkButton
            variant="primary"
            pending={pending}
            disabled={beast.isLocked}
            onClick={confirm}
          >
            确认放生
          </InkButton>
        </div>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          <span className="font-mono">{beast.level}</span> 级 · 成长{' '}
          <span className="font-mono">{beast.growth.toFixed(3)}</span> ·{' '}
          <span className="font-mono">{beast.skillSlotCapacity}</span> 项技能
        </p>
        <p>放生没有收益，无法找回。该灵兽会同时取消携带。</p>
      </div>
    </InkModal>
  );
}
