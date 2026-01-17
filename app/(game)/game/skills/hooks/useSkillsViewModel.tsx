'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import type { InkDialogState } from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { StatusEffect } from '@/types/constants';
import type { Skill } from '@/types/cultivator';
import { getStatusEffectInfo } from '@/types/dictionaries';
import { useCallback, useState } from 'react';

export interface UseSkillsViewModelReturn {
  // 数据
  cultivator: ReturnType<typeof useCultivator>['cultivator'];
  skills: ReturnType<typeof useCultivator>['skills'];
  isLoading: boolean;
  note: string | undefined;
  maxSkills: number;

  // Dialog 状态
  dialog: InkDialogState | null;
  closeDialog: () => void;

  // 详情 Modal 状态
  selectedSkill: Skill | null;
  isModalOpen: boolean;
  openSkillDetail: (skill: Skill) => void;
  closeSkillDetail: () => void;

  // 业务操作
  openForgetConfirm: (skill: Skill) => void;
  showEffectHelp: (effect: StatusEffect) => void;
}

/**
 * 神通页面 ViewModel
 */
export function useSkillsViewModel(): UseSkillsViewModelReturn {
  const { cultivator, skills, isLoading, note, refresh } = useCultivator();
  const { pushToast, openDialog } = useInkUI();

  // Dialog 状态
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // 详情 Modal 状态
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const maxSkills = cultivator?.max_skills ?? 3;

  // 关闭 Dialog
  const closeDialog = useCallback(() => {
    setDialog(null);
  }, []);

  // 打开神通详情
  const openSkillDetail = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    setIsModalOpen(true);
  }, []);

  // 关闭神通详情
  const closeSkillDetail = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // 遗忘神通
  const handleForget = useCallback(
    async (skill: Skill) => {
      if (!cultivator) return;

      try {
        setDialog((prev) => ({
          ...prev!,
          loading: true,
        }));

        const response = await fetch('/api/cultivator/skills/forget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skillId: skill.id,
          }),
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.error || '遗忘失败');
        }

        pushToast({ message: `已将【${skill.name}】遗忘`, tone: 'default' });
        await refresh();
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
    [cultivator, pushToast, refresh],
  );

  // 打开遗忘确认
  const openForgetConfirm = useCallback(
    (skill: Skill) => {
      setDialog({
        id: 'forget-confirm',
        title: '遗忘神通',
        content: (
          <div className="text-center py-4 space-y-2">
            <p>
              确定要自废{' '}
              <span className="font-bold text-ink-primary">{skill.name}</span>{' '}
              吗？
            </p>
            <p className="text-xs text-ink-secondary">
              此乃逆天之举，遗忘后将无法找回该神通的感悟。
            </p>
          </div>
        ),
        confirmLabel: '自废神通',
        cancelLabel: '不可',
        loadingLabel: '遗忘中...',
        onConfirm: async () => await handleForget(skill),
      });
    },
    [handleForget],
  );

  // 显示效果帮助
  const showEffectHelp = useCallback(
    (effect: StatusEffect) => {
      openDialog({
        title: '神通效果说明',
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
    skills,
    isLoading,
    note,
    maxSkills,
    dialog,
    closeDialog,
    selectedSkill,
    isModalOpen,
    openSkillDetail,
    closeSkillDetail,
    openForgetConfirm,
    showEffectHelp,
  };
}
