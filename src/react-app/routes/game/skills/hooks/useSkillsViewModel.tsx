import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  toProductDisplayModel,
  type ProductDisplayModel,
} from '@app/components/feature/products';
import type { InkDialogState } from '@app/components/ui/InkDialog';
import {
  usePlayerStateDomainVersion,
  usePlayerStateView,
  type PlayerStateView,
} from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { MAX_OWNED_CREATION_PRODUCTS_PER_TYPE } from '@shared/config/creationProductLimits';
import { DEFAULT_MAX_ACTIVE_SKILLS } from '@shared/config/skillLimits';
import { useCallback, useEffect, useState } from 'react';

export type V2Skill = ProductDisplayModel & { id: string };

export interface UseSkillsViewModelReturn {
  cultivator: PlayerStateView['cultivator'];
  skills: V2Skill[];
  isLoading: boolean;
  note: string | undefined;
  maxSkills: number;
  maxOwnedSkills: number;
  enabledSkillCount: number;
  dialog: InkDialogState | null;
  closeDialog: () => void;
  selectedSkill: V2Skill | null;
  isModalOpen: boolean;
  pendingToggleId: string | null;
  openSkillDetail: (skill: V2Skill) => void;
  closeSkillDetail: () => void;
  toggleSkillEnabled: (skill: V2Skill) => Promise<void>;
  openForgetConfirm: (skill: V2Skill) => void;
}

export function useSkillsViewModel(): UseSkillsViewModelReturn {
  const { cultivator, isLoading, note } = usePlayerStateView();
  const productsVersion = usePlayerStateDomainVersion('products');
  const { mutate } = usePlayerStateActions();
  const { pushToast, openDialog } = useInkUI();

  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<V2Skill | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [skills, setSkills] = useState<V2Skill[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(Boolean(cultivator));
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);

  const maxSkills = DEFAULT_MAX_ACTIVE_SKILLS;
  const maxOwnedSkills = MAX_OWNED_CREATION_PRODUCTS_PER_TYPE;
  const enabledSkillCount = skills.filter((skill) => skill.isEquipped).length;

  useEffect(() => {
    if (!cultivator?.id) {
      return;
    }

    let cancelled = false;

    const loadSkills = async () => {
      setSkillsLoading(true);
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
        if (!cancelled) {
          console.error('加载神通失败:', e);
        }
      } finally {
        if (!cancelled) {
          setSkillsLoading(false);
        }
      }
    };

    void loadSkills();

    return () => {
      cancelled = true;
    };
  }, [cultivator?.id, productsVersion]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const openSkillDetail = useCallback((skill: V2Skill) => {
    setSelectedSkill(skill);
    setIsModalOpen(true);
  }, []);

  const closeSkillDetail = useCallback(() => {
    setIsModalOpen(false);
    setSelectedSkill(null);
  }, []);

  const toggleSkillEnabled = useCallback(
    async (skill: V2Skill) => {
      if (!cultivator) return;

      setPendingToggleId(skill.id);
      try {
        const data = await mutate<{
          productId: string;
          productType: string;
          equipped: boolean;
        }>(
          fetch('/api/v2/products/equip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: skill.id }),
          }),
        );
        pushToast({
          message: data.equipped
            ? `【${skill.name}】已启用`
            : `【${skill.name}】已停用`,
          tone: 'success',
        });
      } catch (e) {
        pushToast({
          message: e instanceof Error ? e.message : '神通启停失败',
          tone: 'danger',
        });
      } finally {
        setPendingToggleId(null);
      }
    },
    [cultivator, mutate, pushToast],
  );

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
            await mutate(
              fetch(`/api/v2/products/${skill.id}`, {
                method: 'DELETE',
              }),
            );
            pushToast({
              message: `【${skill.name}】已从道基消散`,
              tone: 'default',
            });
          } catch (e) {
            pushToast({
              message: e instanceof Error ? e.message : '遗忘失败',
              tone: 'danger',
            });
          }
        },
      });
    },
    [openDialog, mutate, pushToast],
  );

  return {
    cultivator,
    skills,
    isLoading: isLoading || skillsLoading,
    note,
    maxSkills,
    maxOwnedSkills,
    enabledSkillCount,
    dialog,
    closeDialog,
    selectedSkill,
    isModalOpen,
    pendingToggleId,
    openSkillDetail,
    closeSkillDetail,
    toggleSkillEnabled,
    openForgetConfirm,
  };
}
