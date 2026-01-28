'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import type { InkDialogState } from '@/components/ui/InkDialog';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { StatusEffect } from '@/types/constants';
import type { CultivationTechnique } from '@/types/cultivator';
import { getStatusEffectInfo } from '@/types/dictionaries';
import { useCallback, useState } from 'react';

export interface UseTechniquesViewModelReturn {
  // 数据
  cultivator: ReturnType<typeof useCultivator>['cultivator'];
  techniques: CultivationTechnique[];
  isLoading: boolean;
  note: string | undefined;

  // Dialog 状态
  dialog: InkDialogState | null;
  closeDialog: () => void;

  // 详情 Modal 状态
  selectedTechnique: CultivationTechnique | null;
  isModalOpen: boolean;
  openTechniqueDetail: (technique: CultivationTechnique) => void;
  closeTechniqueDetail: () => void;

  // 业务操作
  openForgetConfirm: (technique: CultivationTechnique) => void;
  showEffectHelp: (effect: StatusEffect) => void;
}

/**
 * 功法页面 ViewModel
 */
export function useTechniquesViewModel(): UseTechniquesViewModelReturn {
  const { cultivator, isLoading, note, refreshCultivator } = useCultivator();
  const { pushToast, openDialog } = useInkUI();

  // Dialog 状态
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // 详情 Modal 状态
  const [selectedTechnique, setSelectedTechnique] =
    useState<CultivationTechnique | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 关闭 Dialog
  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  // 打开功法详情
  const openTechniqueDetail = useCallback((technique: CultivationTechnique) => {
    setSelectedTechnique(technique);
    setIsModalOpen(true);
  }, []);

  // 关闭功法详情
  const closeTechniqueDetail = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // 遗忘功法
  const handleForget = useCallback(
    async (technique: CultivationTechnique) => {
      if (!cultivator) return;
      if (!technique.id) {
        pushToast({
          message: '无法遗忘该功法（缺少ID）',
          tone: 'danger',
        });
        return;
      }

      try {
        setDialog((prev) => ({
          ...prev!,
          loading: true,
        }));

        const response = await fetch('/api/cultivator/techniques/forget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            techniqueId: technique.id,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '遗忘失败');
        }

        pushToast({ message: `已将【${technique.name}】遗忘`, tone: 'default' });
        // 功法属于核心数据，需要完整刷新
        await refreshCultivator();
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '操作失败',
          tone: 'danger',
        });
      } finally {
        setDialog((prev) => ({
          ...prev!,
          loading: false,
        }));
      }
    },
    [cultivator, pushToast, refreshCultivator],
  );

  // 打开遗忘确认
  const openForgetConfirm = useCallback(
    (technique: CultivationTechnique) => {
      setDialog({
        id: 'forget-confirm',
        title: '遗忘功法',
        content: (
          <div className="text-center py-4 space-y-2">
            <p>
              确定要废除{' '}
              <span className="font-bold text-ink-primary">
                {technique.name}
              </span>{' '}
              吗？
            </p>
            <p className="text-xs text-ink-secondary">
              自废功法乃大忌，需谨慎行事。
            </p>
          </div>
        ),
        confirmLabel: '自废功法',
        cancelLabel: '不可',
        loadingLabel: '遗忘中...',
        onConfirm: async () => await handleForget(technique),
      });
    },
    [handleForget],
  );

  // 显示效果帮助
  const showEffectHelp = useCallback(
    (effect: StatusEffect) => {
      openDialog({
        title: '效果说明',
        content: (
          <div className="text-center py-4 space-y-2">
            <p>{getStatusEffectInfo(effect).description}</p>
          </div>
        ),
        confirmLabel: '了然',
      });
    },
    [openDialog],
  );

  return {
    cultivator,
    techniques: cultivator?.cultivations || [],
    isLoading,
    note,
    dialog,
    closeDialog,
    selectedTechnique,
    isModalOpen,
    openTechniqueDetail,
    closeTechniqueDetail,
    openForgetConfirm,
    showEffectHelp,
  };
}
