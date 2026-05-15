import { InkModal } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { format } from 'd3-format';
import type { BreakthroughChancePreviewData } from '../hooks/useRetreatViewModel';

interface BreakthroughConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  chancePreview?: BreakthroughChancePreviewData | null;
}

/**
 * 突破确认弹窗
 */
export function BreakthroughConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  chancePreview,
}: BreakthroughConfirmModalProps) {
  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title="【突破确认】"
      footer={
        <div className="mt-4 flex gap-3">
          <InkButton onClick={onClose} className="flex-1">
            再做准备
          </InkButton>
          <InkButton onClick={onConfirm} variant="primary" className="flex-1">
            破关！
          </InkButton>
        </div>
      }
    >
      <div className="mt-4 space-y-3 text-sm leading-6">
        <p className="text-ink-secondary">
          道友确定要尝试突破吗？此举关乎道途，不可不慎重。
        </p>

        <div className="border-wood/35 bg-bgpaper space-y-2 border border-dashed p-3">
          <p className="text-wood font-medium">【突破风险】</p>
          <p className="text-wood text-xs">
            • 若冲关失败，修为将有所损耗，真元涣散
          </p>
          <p className="text-wood text-xs">
            • 道行感悟将有所降低，心生迷惘
          </p>
          <p className="text-wood text-xs">
            • 连续失败三次将生心魔，影响后续突破
          </p>
        </div>

        {chancePreview && (
          <div className="border-teal/35 bg-bgpaper space-y-1 border border-dashed p-3">
            <p className="text-teal font-medium">【当前成功率推演】</p>
            <p className="text-teal text-xs">
              基础成功率：{format('.1%')(Math.min(chancePreview.baseChance, 1))}
            </p>
            {chancePreview.buffBonus > 0 && (
              <p className="text-xs text-emerald-800">
                机缘加成：+{format('.1%')(chancePreview.buffBonus)}
              </p>
            )}
            <p className="text-xs text-emerald-800">
              最终成功率：{format('.1%')(Math.min(chancePreview.finalChance, 1))}
            </p>
          </div>
        )}

        <p className="text-ink-secondary text-center text-xs opacity-80">
          修行之路，本就充满坎坷。机缘造化，在此一举。
        </p>
      </div>
    </InkModal>
  );
}
