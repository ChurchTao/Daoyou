'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { InkActionGroup, InkBadge, InkButton, InkList, InkListItem, InkNotice, InkDialog, type InkDialogState } from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { formatEffectsText } from '@/lib/utils/effectDisplay';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { GeneratedFate } from '@/engine/fate/creation/types';
import type { PreHeavenFate } from '@/types/cultivator';
import type { BuffInstanceState } from '@/engine/buff/types';

export default function FateReshapePage() {
  const router = useRouter();
  const { cultivator, refresh } = useCultivator();
  const [loading, setLoading] = useState(false);
  const [previewFates, setPreviewFates] = useState<GeneratedFate[] | null>(null);
  const [usesRemaining, setUsesRemaining] = useState<number | null>(null);
  
  // Selection states
  const [selectedOldIndices, setSelectedOldIndices] = useState<number[]>([]);
  const [selectedNewIndices, setSelectedNewIndices] = useState<number[]>([]);

  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // Get current talisman status
  const persistentStatuses = (cultivator?.persistent_statuses || []) as BuffInstanceState[];
  const reshapeBuff = persistentStatuses.find(
    (s) => s.configId === 'reshape_fate_talisman'
  );
  
  const currentUses = usesRemaining !== null 
    ? usesRemaining 
    : ((reshapeBuff?.metadata?.usesRemaining as number) ?? 0);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cultivator/fate/reshape/preview');
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || '预览失败');
      }

      setPreviewFates(data.fates);
      setUsesRemaining(data.usesRemaining);
      // Reset selections
      setSelectedOldIndices([]);
      setSelectedNewIndices([]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setDialog({
        id: 'preview-error',
        title: '预览失败',
        content: <p>{msg}</p>,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cultivator/fate/reshape/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedIndices: selectedNewIndices,
          replaceIndices: selectedOldIndices,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '重塑失败');
      }

      setDialog({
        id: 'commit-success',
        title: '逆天改命成功',
        content: <p>{data.message}</p>,
        onConfirm: async () => {
          refresh();
          router.push('/game');
        },
        confirmLabel: '确定'
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setDialog({
        id: 'commit-error',
        title: '操作失败',
        content: <p>{msg}</p>,
      });
      setLoading(false);
    }
  };

  const toggleOldSelection = (index: number) => {
    if (selectedOldIndices.includes(index)) {
      setSelectedOldIndices(prev => prev.filter(i => i !== index));
    } else {
      setSelectedOldIndices(prev => [...prev, index]);
    }
  };

  const toggleNewSelection = (index: number) => {
    if (selectedNewIndices.includes(index)) {
      setSelectedNewIndices(prev => prev.filter(i => i !== index));
    } else {
      setSelectedNewIndices(prev => [...prev, index]);
    }
  };

  if (!cultivator) return null;

  return (
    <InkPageShell
      title="逆天改命"
      subtitle={`剩余次数：${currentUses}`}
      backHref="/game"
    >
      {!previewFates ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-6xl mb-4">🔮</div>
          <p className="text-lg opacity-80 text-center max-w-xs">
            消耗一次重塑机会，可窥探三天机，<br/>从中择选命格以替换旧命。
          </p>
          <InkButton 
            variant="primary" 
            onClick={handlePreview}
            disabled={loading || currentUses <= 0}
          >
            {loading ? '推演中...' : '开始推演'}
          </InkButton>
          {currentUses <= 0 && (
             <InkNotice>重塑次数已用尽，请重新使用符箓。</InkNotice>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <InkNotice>
            请勾选需要<b>移除的旧命格</b>和需要<b>接纳的新命格</b>。<br/>
            确认后，未勾选的新命格将消散，未勾选的旧命格将保留。
          </InkNotice>

          <InkSection title="【当前命格】（勾选以移除）">
            <InkList>
              {cultivator.pre_heaven_fates.map((fate: PreHeavenFate, idx: number) => (
                <InkListItem
                  key={idx}
                  title={
                    <span className={selectedOldIndices.includes(idx) ? 'line-through opacity-50' : ''}>
                      {fate.name}
                    </span>
                  }
                  meta={<InkBadge tier={fate.quality}>{fate.quality}</InkBadge>}
                  description={formatEffectsText(fate.effects)}
                  actions={
                    <InkButton
                      variant={selectedOldIndices.includes(idx) ? 'primary' : 'secondary'}
                      className={selectedOldIndices.includes(idx) ? 'bg-red-800 hover:bg-red-700' : ''}
                      onClick={() => toggleOldSelection(idx)}
                    >
                      {selectedOldIndices.includes(idx) ? '将移除' : '保留'}
                    </InkButton>
                  }
                />
              ))}
            </InkList>
          </InkSection>

          <InkSection title="【新命格预览】（勾选以接纳）">
            <InkList>
              {previewFates.map((fate, idx) => (
                <InkListItem
                  key={idx}
                  title={fate.name}
                  meta={<InkBadge tier={fate.quality}>{fate.quality}</InkBadge>}
                  description={
                    <div className="space-y-1">
                      <div>{fate.description}</div>
                      <div className="text-xs opacity-70">{formatEffectsText(fate.effects)}</div>
                    </div>
                  }
                  actions={
                    <InkButton
                      variant={selectedNewIndices.includes(idx) ? 'primary' : 'outline'}
                      onClick={() => toggleNewSelection(idx)}
                    >
                      {selectedNewIndices.includes(idx) ? '已选' : '选择'}
                    </InkButton>
                  }
                />
              ))}
            </InkList>
          </InkSection>

          <InkActionGroup>
            <InkButton 
              variant="secondary" 
              onClick={() => {
                  setPreviewFates(null);
                  setSelectedNewIndices([]);
                  setSelectedOldIndices([]);
              }}
            >
              放弃本次
            </InkButton>
            <InkButton 
              variant="primary" 
              onClick={handleCommit}
              disabled={loading}
            >
              {loading ? '逆天改命中...' : '确认改命'}
            </InkButton>
          </InkActionGroup>
        </div>
      )}

      <InkDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
      />
    </InkPageShell>
  );
}