'use client';

import { InkModal } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';

interface BreakthroughConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 突破确认弹窗
 */
export function BreakthroughConfirmModal({
  isOpen,
  onClose,
  onConfirm,
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

        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <p className="font-medium text-amber-900">【突破风险】</p>
          <p className="text-xs text-amber-800">
            • 若冲关失败，修为将有所损耗，真元涣散
          </p>
          <p className="text-xs text-amber-800">
            • 道行感悟将有所降低，心生迷惘
          </p>
          <p className="text-xs text-amber-800">
            • 连续失败三次将生心魔，影响后续突破
          </p>
        </div>

        <p className="text-ink-secondary text-center text-xs opacity-80">
          修行之路，本就充满坎坷。机缘造化，在此一举。
        </p>
      </div>
    </InkModal>
  );
}
