import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  toProductDisplayModel,
  type ProductDisplayModel,
} from '@app/components/feature/products';
import {
  usePlayerStateDomainVersion,
  usePlayerStateView,
} from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import {
  MAX_EQUIPPED_GONGFA,
  MAX_OWNED_CREATION_PRODUCTS_PER_TYPE,
} from '@shared/config/creationProductLimits';
import { useCallback, useEffect, useState } from 'react';

export type V2Technique = ProductDisplayModel & { id: string };

export function useTechniquesViewModel() {
  const { cultivator, isLoading, note } = usePlayerStateView();
  const productsVersion = usePlayerStateDomainVersion('products');
  const { mutate } = usePlayerStateActions();
  const { pushToast, openDialog } = useInkUI();

  const [selectedTechnique, setSelectedTechnique] = useState<V2Technique | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [techniques, setTechniques] = useState<V2Technique[]>([]);
  const [techniquesLoading, setTechniquesLoading] = useState(Boolean(cultivator));
  const [pendingToggleId, setPendingToggleId] = useState<string | null>(null);
  const maxOwnedTechniques = MAX_OWNED_CREATION_PRODUCTS_PER_TYPE;
  const maxEnabledTechniques = MAX_EQUIPPED_GONGFA;
  const enabledTechniqueCount = techniques.filter(
    (technique) => technique.isEquipped,
  ).length;

  useEffect(() => {
    if (!cultivator?.id) {
      return;
    }

    let cancelled = false;

    const loadTechniques = async () => {
      setTechniquesLoading(true);
      try {
        const res = await fetch('/api/v2/products?type=gongfa');
        const data = await res.json();
        if (cancelled) return;

        if (data.success) {
          const parsed: V2Technique[] = (data.data ?? []).map(
            (r: Record<string, unknown>) => ({
              id: r.id as string,
              ...toProductDisplayModel(r),
            }),
          );
          setTechniques(parsed);
        }
      } catch (e) {
        if (!cancelled) {
          console.error('加载功法失败:', e);
        }
      } finally {
        if (!cancelled) {
          setTechniquesLoading(false);
        }
      }
    };

    void loadTechniques();

    return () => {
      cancelled = true;
    };
  }, [cultivator?.id, productsVersion]);

  const openTechniqueDetail = useCallback((technique: V2Technique) => {
    setSelectedTechnique(technique);
    setIsModalOpen(true);
  }, []);

  const closeTechniqueDetail = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTechnique(null);
  }, []);

  const toggleTechniqueEnabled = useCallback(
    async (technique: V2Technique) => {
      if (!cultivator) return;

      setPendingToggleId(technique.id);
      try {
        const data = await mutate<{
          productId: string;
          productType: string;
          equipped: boolean;
        }>(
          fetch('/api/v2/products/equip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId: technique.id }),
          }),
        );
        pushToast({
          message: data.equipped
            ? `【${technique.name}】已启用`
            : `【${technique.name}】已停用`,
          tone: 'success',
        });
      } catch (e) {
        pushToast({
          message: e instanceof Error ? e.message : '功法启停失败',
          tone: 'danger',
        });
      } finally {
        setPendingToggleId(null);
      }
    },
    [cultivator, mutate, pushToast],
  );

  const openForgetConfirm = useCallback(
    (technique: V2Technique) => {
      openDialog({
        title: '废除功法',
        content: (
          <div className="space-y-2 py-2 text-center">
            <p>
              确定要废除{' '}
              <span className="text-ink-primary font-bold">{technique.name}</span>{' '}
              吗？
            </p>
            <p className="text-ink-secondary text-xs">自废功法乃大忌，需谨慎行事。</p>
          </div>
        ),
        confirmLabel: '自废功法',
        cancelLabel: '不可',
        onConfirm: async () => {
          try {
            await mutate(
              fetch(`/api/v2/products/${technique.id}`, {
                method: 'DELETE',
              }),
            );
            pushToast({
              message: `【${technique.name}】已从道基消散`,
              tone: 'default',
            });
          } catch (e) {
            pushToast({
              message: e instanceof Error ? e.message : '废除失败',
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
    techniques,
    isLoading: isLoading || techniquesLoading,
    note,
    maxOwnedTechniques,
    maxEnabledTechniques,
    enabledTechniqueCount,
    selectedTechnique,
    isModalOpen,
    pendingToggleId,
    openTechniqueDetail,
    closeTechniqueDetail,
    toggleTechniqueEnabled,
    openForgetConfirm,
  };
}
