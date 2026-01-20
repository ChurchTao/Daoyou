'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { InkActionGroup, InkBadge, InkButton, InkList, InkListItem, InkNotice, InkDialog, type InkDialogState } from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { formatEffectsText } from '@/lib/utils/effectDisplay';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { GeneratedFate } from '@/engine/fate/creation/types';
import type { PreHeavenFate } from '@/types/cultivator';
import type { BuffInstanceState } from '@/engine/buff/types';

export default function FateReshapePage() {
  const router = useRouter();
  const { cultivator, refresh } = useCultivator();
  const [loading, setLoading] = useState(false);
  const [previewFates, setPreviewFates] = useState<GeneratedFate[] | null>(null);
  const [currentUses, setCurrentUses] = useState<number>(0);
  const [checkingBuff, setCheckingBuff] = useState(false);

  // Selection states
  const [selectedOldIndices, setSelectedOldIndices] = useState<number[]>([]);
  const [selectedNewIndices, setSelectedNewIndices] = useState<number[]>([]);

  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  // 从 API 获取当前 buff 状态
  const checkBuffStatus = useCallback(async () => {
    setCheckingBuff(true);
    try {
      const res = await fetch('/api/cultivator/talismans');
      const data = await res.json();
      if (data.talismans) {
        const reshapeBuff = data.talismans.find((t: { id: string }) => t.id === 'reshape_fate_talisman');
        setCurrentUses(reshapeBuff?.usesRemaining ?? 0);
        return reshapeBuff;
      }
      setCurrentUses(0);
      return null;
    } catch (e) {
      console.error('获取符箓状态失败:', e);
      setCurrentUses(0);
      return null;
    } finally {
      setCheckingBuff(false);
    }
  }, []);

  // 初始化时检查 buff 状态
  useEffect(() => {
    if (cultivator) {
      checkBuffStatus();
    }
  }, [cultivator, checkBuffStatus]);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cultivator/fate/reshape/preview');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '推演失败');
      }

      setPreviewFates(data.fates);
      setCurrentUses(data.usesRemaining);
      // Reset selections
      setSelectedOldIndices([]);
      setSelectedNewIndices([]);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setDialog({
        id: 'preview-error',
        title: '推演受阻',
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
        confirmLabel: '善哉'
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setDialog({
        id: 'commit-error',
        title: '逆天失败',
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
      subtitle={`天机推演次数：${currentUses}`}
      backHref="/game"
    >
      {!previewFates ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="text-6xl mb-4">🔮</div>
          <p className="text-lg opacity-80 text-center max-w-xs">
            燃烧一次天机逆命符之力，可窥探三条未来命数。<br/>
            道友可从中择选合意者，替换现有命格，以此逆天改命。
          </p>
          <InkButton
            variant="primary"
            onClick={handlePreview}
            disabled={loading || checkingBuff || currentUses <= 0}
          >
            {loading ? '推演天机中...' : checkingBuff ? '检查道韵中...' : '燃符推演'}
          </InkButton>
          {currentUses <= 0 && (
             <InkNotice>符箓之力已尽，请重新使用。</InkNotice>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <InkNotice>
            请勾选需要<b>舍弃的旧命数</b>和需要<b>承接的新机缘</b>。<br/>
            确认后，未选之新命将消散归于虚无，未选之旧命将固守道身。
          </InkNotice>

          <InkSection title="【现有命数】（勾选以舍弃）">
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
                      {selectedOldIndices.includes(idx) ? '将舍弃' : '固守'}
                    </InkButton>
                  }
                />
              ))}
            </InkList>
          </InkSection>

          <InkSection title="【推演结果】（勾选以承接）">
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
                      {selectedNewIndices.includes(idx) ? '已定' : '契合'}
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
              道心未定
            </InkButton>
            <InkButton 
              variant="primary" 
              onClick={handleCommit}
              disabled={loading}
            >
              {loading ? '逆天改命中...' : '逆转乾坤'}
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
