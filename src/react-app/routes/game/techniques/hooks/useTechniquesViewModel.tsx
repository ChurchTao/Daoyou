import { useInkUI } from '@app/components/providers/InkUIProvider';
import {
  toProductDisplayModel,
  type ProductDisplayModel,
} from '@app/components/feature/products';
import { useCultivator } from '@app/lib/contexts/CultivatorContext';
import { useCallback, useEffect, useState } from 'react';

export type V2Technique = ProductDisplayModel & { id: string };

export function useTechniquesViewModel() {
  const { cultivator, isLoading, note, refreshCultivator } = useCultivator();
  const { pushToast, openDialog } = useInkUI();

  const [selectedTechnique, setSelectedTechnique] = useState<V2Technique | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [techniques, setTechniques] = useState<V2Technique[]>([]);
  const [techniquesLoading, setTechniquesLoading] = useState(Boolean(cultivator));

  const fetchTechniques = useCallback(async () => {
    if (!cultivator) return;
    setTechniquesLoading(true);
    try {
      const res = await fetch('/api/v2/products?type=gongfa');
      const data = await res.json();
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
      console.error('加载功法失败:', e);
    } finally {
      setTechniquesLoading(false);
    }
  }, [cultivator]);

  useEffect(() => {
    if (!cultivator) {
      return;
    }

    let cancelled = false;

    const loadInitialTechniques = async () => {
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
        if (cancelled) return;
        console.error('加载功法失败:', e);
      } finally {
        if (!cancelled) {
          setTechniquesLoading(false);
        }
      }
    };

    void loadInitialTechniques();

    return () => {
      cancelled = true;
    };
  }, [cultivator]);

  const openTechniqueDetail = useCallback((technique: V2Technique) => {
    setSelectedTechnique(technique);
    setIsModalOpen(true);
  }, []);

  const closeTechniqueDetail = useCallback(() => {
    setIsModalOpen(false);
    setSelectedTechnique(null);
  }, []);

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
            const res = await fetch(`/api/v2/products/${technique.id}`, {
              method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            pushToast({
              message: `【${technique.name}】已从道基消散`,
              tone: 'default',
            });
            await refreshCultivator();
            await fetchTechniques();
          } catch (e) {
            pushToast({
              message: e instanceof Error ? e.message : '废除失败',
              tone: 'danger',
            });
          }
        },
      });
    },
    [openDialog, pushToast, refreshCultivator, fetchTechniques],
  );

  return {
    cultivator,
    techniques,
    isLoading: isLoading || techniquesLoading,
    note,
    selectedTechnique,
    isModalOpen,
    openTechniqueDetail,
    closeTechniqueDetail,
    openForgetConfirm,
    refreshTechniques: fetchTechniques,
  };
}
