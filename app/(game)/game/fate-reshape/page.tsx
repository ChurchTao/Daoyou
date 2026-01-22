'use client';

import { InkPageShell, InkSection } from '@/components/layout';
import { useInkUI } from '@/components/providers/InkUIProvider';
import {
  InkActionGroup,
  InkBadge,
  InkButton,
  InkDialog,
  InkList,
  InkListItem,
  InkNotice,
  type InkDialogState,
} from '@/components/ui';
import { EffectConfig } from '@/engine/effect';
import type { GeneratedFate } from '@/engine/fate/creation/types';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { formatAllEffects } from '@/lib/utils/effectDisplay';
import type { PreHeavenFate } from '@/types/cultivator';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function FateReshapePage() {
  const router = useRouter();
  const { cultivator, refresh } = useCultivator();
  const { pushToast, openDialog } = useInkUI();
  const [loading, setLoading] = useState(false);
  const [previewFates, setPreviewFates] = useState<GeneratedFate[] | null>(
    null,
  );
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
        const reshapeBuff = data.talismans.find(
          (t: { id: string }) => t.id === 'reshape_fate_talisman',
        );
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
      openDialog({
        title: '推演受阻',
        content: <p>{msg}</p>,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    // 校验提示
    const hasNoChanges =
      selectedOldIndices.length === 0 && selectedNewIndices.length === 0;
    if (hasNoChanges) {
      pushToast({
        message: '未作任何更改，无法逆转乾坤',
        tone: 'warning',
      });
      return;
    }
    // 校验命格数量限制：最多3个
    const currentFatesCount = cultivator?.pre_heaven_fates.length || 3;
    const newFatesCount = selectedNewIndices.length;
    const discardFatesCount = selectedOldIndices.length;
    const finalFatesCount =
      currentFatesCount + newFatesCount - discardFatesCount;

    if (finalFatesCount > 3) {
      pushToast({
        message: `命数过多，肉身难承其重，至多可持三道先天命格（将拥有${finalFatesCount}道）`,
        tone: 'warning',
      });
      return;
    }

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
        confirmLabel: '善哉',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      openDialog({
        title: '逆天失败',
        content: <p>{msg}</p>,
      });
      setLoading(false);
    }
  };

  const toggleOldSelection = (index: number) => {
    if (selectedOldIndices.includes(index)) {
      setSelectedOldIndices((prev) => prev.filter((i) => i !== index));
    } else {
      setSelectedOldIndices((prev) => [...prev, index]);
    }
  };

  const toggleNewSelection = (index: number) => {
    if (selectedNewIndices.includes(index)) {
      setSelectedNewIndices((prev) => prev.filter((i) => i !== index));
    } else {
      setSelectedNewIndices((prev) => [...prev, index]);
    }
  };

  const renderEffectsList = (effects: EffectConfig[]) => {
    if (!effects || effects.length === 0) return null;
    const infos = formatAllEffects(effects);
    return (
      <ul className="list-inside list-disc space-y-1">
        {infos.map((e, i) => (
          <li key={i}>
            {e.icon} {e.description}
          </li>
        ))}
      </ul>
    );
  };

  if (!cultivator) return null;

  return (
    <InkPageShell
      title="逆天改命"
      subtitle={`天机推演次数：${currentUses}`}
      backHref="/game"
    >
      {!previewFates ? (
        <div className="flex flex-col items-center justify-center space-y-4 py-12">
          <div className="mb-4 text-6xl">🔮</div>
          <p className="max-w-xs text-center text-lg opacity-80">
            燃烧一次天机逆命符之力，可窥探三条未来命数。
            <br />
            道友可从中择选合意者，替换现有命格，以此逆天改命。
          </p>
          <InkButton
            variant="primary"
            onClick={handlePreview}
            disabled={loading || checkingBuff || currentUses <= 0}
          >
            {loading
              ? '推演天机中...'
              : checkingBuff
                ? '检查道韵中...'
                : '燃符推演'}
          </InkButton>
          {currentUses <= 0 && (
            <InkNotice>符箓之力已尽，请重新使用。</InkNotice>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <InkNotice>
            请勾选需要<b>舍弃的旧命数</b>和需要<b>承接的新机缘</b>。<br />
            确认后，未选之新命将消散归于虚无，未选之旧命将固守道身。
          </InkNotice>

          <InkSection title="【现有命数】（勾选以舍弃）">
            <InkList>
              {cultivator.pre_heaven_fates.map(
                (fate: PreHeavenFate, idx: number) => (
                  <InkListItem
                    key={idx}
                    title={
                      <div className="flex items-center">
                        <span className="text-ink-secondary">{fate.name}</span>
                        {fate.quality && <InkBadge tier={fate.quality} />}
                      </div>
                    }
                    meta={renderEffectsList(fate.effects || [])}
                    description={fate.description}
                    actions={
                      <InkButton
                        variant={
                          selectedOldIndices.includes(idx)
                            ? 'primary'
                            : 'secondary'
                        }
                        onClick={() => toggleOldSelection(idx)}
                      >
                        {selectedOldIndices.includes(idx) ? '将舍弃' : '固守'}
                      </InkButton>
                    }
                  />
                ),
              )}
            </InkList>
          </InkSection>

          <InkSection title="【推演结果】（勾选以承接）">
            <InkList>
              {previewFates.map((fate, idx) => (
                <InkListItem
                  key={idx}
                  title={
                    <div className="flex items-center">
                      <span className="text-ink-secondary">{fate.name}</span>
                      {fate.quality && <InkBadge tier={fate.quality} />}
                    </div>
                  }
                  meta={renderEffectsList(fate.effects)}
                  description={fate.description}
                  actions={
                    <InkButton
                      variant={
                        selectedNewIndices.includes(idx) ? 'primary' : 'outline'
                      }
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
              onClick={async () => {
                setSelectedNewIndices([]);
                setSelectedOldIndices([]);
                await handlePreview();
              }}
              disabled={loading || currentUses < 1}
            >
              {loading ? '推演天机中...' : `重新推演（剩余${currentUses}次）`}
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

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
    </InkPageShell>
  );
}
