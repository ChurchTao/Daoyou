import { InkModal } from '@app/components/layout';
import { InkBadge, InkButton } from '@app/components/ui';
import type { CombatLogDetail } from './combatLogDetails';

interface CombatLogDetailModalProps {
  detail: CombatLogDetail | null;
  onClose: () => void;
}

export function CombatLogDetailModal({
  detail,
  onClose,
}: CombatLogDetailModalProps) {
  if (!detail) return null;

  return (
    <InkModal
      isOpen
      onClose={onClose}
      title={
        detail.kind === 'ability'
          ? `《${detail.name}》`
          : `「${detail.name}」`
      }
      footer={
        <div className="flex justify-end">
          <InkButton variant="primary" onClick={onClose}>
            返回战斗
          </InkButton>
        </div>
      }
    >
      <div className="space-y-4 text-sm leading-7">
        <div className="text-center">
          <InkBadge tone={detail.kind === 'ability' ? 'accent' : 'default'}>
            {detail.kindLabel}
          </InkBadge>
        </div>
        <section>
          <h4 className="text-ink font-semibold">功能说明</h4>
          <p className="text-ink-secondary mt-1">{detail.description}</p>
        </section>
        {detail.rows.length > 0 ? (
          <section className="border-ink/15 space-y-1 border-t border-dashed pt-3">
            {detail.rows.map((row) => (
              <p key={row}>{row}</p>
            ))}
          </section>
        ) : null}
        <p className="text-ink-secondary border-ink/15 border-t border-dashed pt-3 text-xs">
          查看详情期间战斗已暂停，关闭后可手动继续。
        </p>
      </div>
    </InkModal>
  );
}
