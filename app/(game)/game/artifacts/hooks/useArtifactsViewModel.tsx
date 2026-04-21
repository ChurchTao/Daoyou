'use client';

import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  toProductDisplayModel,
  type ProductDisplayModel,
} from '@/components/feature/products';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { useCallback, useEffect, useState } from 'react';

export type V2Artifact = ProductDisplayModel & { id: string };

export function useArtifactsViewModel() {
  const { cultivator, isLoading, note, refreshCultivator } = useCultivator();
  const { pushToast, openDialog } = useInkUI();

  const [selectedArtifact, setSelectedArtifact] = useState<V2Artifact | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [artifacts, setArtifacts] = useState<V2Artifact[]>([]);
  const [artifactsLoading, setArtifactsLoading] = useState(false);

  const fetchArtifacts = useCallback(async () => {
    if (!cultivator) return;
    setArtifactsLoading(true);
    try {
      const res = await fetch('/api/v2/products?type=artifact');
      const data = await res.json();
      if (data.success) {
        const parsed: V2Artifact[] = (data.data ?? []).map(
          (r: Record<string, unknown>) => ({
            id: r.id as string,
            ...toProductDisplayModel(r),
          }),
        );
        setArtifacts(parsed);
      }
    } catch (e) {
      console.error('加载法宝失败:', e);
    } finally {
      setArtifactsLoading(false);
    }
  }, [cultivator]);

  useEffect(() => {
    fetchArtifacts();
  }, [fetchArtifacts]);

  const openArtifactDetail = useCallback((artifact: V2Artifact) => {
    setSelectedArtifact(artifact);
    setIsModalOpen(true);
  }, []);

  const closeArtifactDetail = useCallback(() => {
    setIsModalOpen(false);
    setSelectedArtifact(null);
  }, []);

  const toggleEquip = useCallback(
    async (artifact: V2Artifact) => {
      try {
        const res = await fetch('/api/v2/products/equip', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId: artifact.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const action = data.equipped ? '装备' : '卸下';
        pushToast({
          message: `【${artifact.name}】已${action}`,
          tone: 'default',
        });
        await refreshCultivator();
        await fetchArtifacts();
      } catch (e) {
        pushToast({
          message: e instanceof Error ? e.message : '操作失败',
          tone: 'danger',
        });
      }
    },
    [pushToast, refreshCultivator, fetchArtifacts],
  );

  const openDestroyConfirm = useCallback(
    (artifact: V2Artifact) => {
      openDialog({
        title: '销毁法宝',
        content: (
          <div className="space-y-2 py-2 text-center">
            <p>
              确定要销毁{' '}
              <span className="text-ink-primary font-bold">{artifact.name}</span>{' '}
              吗？
            </p>
            <p className="text-ink-secondary text-xs">
              法宝一经销毁，灵蕴消散，无法复原。
            </p>
          </div>
        ),
        confirmLabel: '销毁',
        cancelLabel: '不可',
        onConfirm: async () => {
          try {
            const res = await fetch(`/api/v2/products/${artifact.id}`, {
              method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            pushToast({
              message: `【${artifact.name}】已销毁`,
              tone: 'default',
            });
            await refreshCultivator();
            await fetchArtifacts();
          } catch (e) {
            pushToast({
              message: e instanceof Error ? e.message : '销毁失败',
              tone: 'danger',
            });
          }
        },
      });
    },
    [openDialog, pushToast, refreshCultivator, fetchArtifacts],
  );

  return {
    cultivator,
    artifacts,
    isLoading: isLoading || artifactsLoading,
    note,
    selectedArtifact,
    isModalOpen,
    openArtifactDetail,
    closeArtifactDetail,
    toggleEquip,
    openDestroyConfirm,
    refreshArtifacts: fetchArtifacts,
  };
}
