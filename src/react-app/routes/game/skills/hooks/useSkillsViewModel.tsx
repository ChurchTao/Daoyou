import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  toProductDisplayModel,
  type ProductDisplayModel,
} from '@app/components/feature/products';
import type { InkDialogState } from '@app/components/ui/InkDialog';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { useCallback, useEffect, useState } from 'react';

export type V2Skill = ProductDisplayModel & { id: string };

export interface UseSkillsViewModelReturn {
  cultivator: ReturnType<typeof useCultivator>['cultivator'];
  skills: V2Skill[];
  isLoading: boolean;
  note: string | undefined;
  maxSkills: number;
  dialog: InkDialogState | null;
  closeDialog: () => void;
  selectedSkill: V2Skill | null;
  isModalOpen: boolean;
  openSkillDetail: (skill: V2Skill) => void;
  closeSkillDetail: () => void;
  openForgetConfirm: (skill: V2Skill) => void;
  refreshSkills: () => void;
}

export function useSkillsViewModel(): UseSkillsViewModelReturn {
  const { cultivator, isLoading, note, refreshCultivator } = useCultivator();
  const { pushToast, openDialog } = useInkUI();

  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<V2Skill | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [skills, setSkills] = useState<V2Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(Boolean(cultivator));

  const maxSkills = cultivator?.max_skills ?? 3;

  const fetchSkills = useCallback(async () => {
    if (!cultivator) return;
    setSkillsLoading(true);
    try {
      const res = await fetch('/api/v2/products?type=skill');
      const data = await res.json();
      if (data.success) {
        const parsed: V2Skill[] = (data.data ?? []).map(
          (r: Record<string, unknown>) => ({
            id: r.id as string,
            ...toProductDisplayModel(r),
          }),
        );
        setSkills(parsed);
      }
    } catch (e) {
      console.error('加载神通失败:', e);
    } finally {
      setSkillsLoading(false);
    }
  }, [cultivator]);

  useEffect(() => {
    if (!cultivator) {
      return;
    }

    let cancelled = false;

    const loadInitialSkills = async () => {
      try {
        const res = await fetch('/api/v2/products?type=skill');
        const data = await res.json();
        if (cancelled) return;

        if (data.success) {
          const parsed: V2Skill[] = (data.data ?? []).map(
            (r: Record<string, unknown>) => ({
              id: r.id as string,
              ...toProductDisplayModel(r),
            }),
          );
          setSkills(parsed);
        }
      } catch (e) {
        if (cancelled) return;
        console.error('加载神通失败:', e);
      } finally {
        if (!cancelled) {
          setSkillsLoading(false);
        }
      }
    };

    void loadInitialSkills();

    return () => {
      cancelled = true;
    };
  }, [cultivator]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const openSkillDetail = useCallback((skill: V2Skill) => {
    setSelectedSkill(skill);
    setIsModalOpen(true);
  }, []);

  const closeSkillDetail = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSkill(null);
  }, []);

  const openForgetConfirm = useCallback(
    (skill: V2Skill) => {
      openDialog({
        title: '遗忘神通',
        content: (
          <p className="py-2">
            道友当真要将【{skill.name}】化为尘埃？此举不可逆转。
          </p>
        ),
        confirmLabel: '道心已决',
        cancelLabel: '再思量',
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/v2/products/${skill.id}`, {
              method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            pushToast({
              message: `【${skill.name}】已从道基消散`,
              tone: 'default',
            });
            await refreshCultivator();
            await fetchSkills();
          } catch (e) {
            pushToast({
              message: e instanceof Error ? e.message : '遗忘失败',
              tone: 'danger',
            });
          }
        },
      });
    },
    [openDialog, pushToast, refreshCultivator, fetchSkills],
  );

  return {
    cultivator,
    skills,
    isLoading: isLoading || skillsLoading,
    note,
    maxSkills,
    dialog,
    closeDialog,
    selectedSkill,
    isModalOpen,
    openSkillDetail,
    closeSkillDetail,
    openForgetConfirm,
    refreshSkills: fetchSkills,
  };
}
