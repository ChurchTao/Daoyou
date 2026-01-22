'use client';

import { InkPageShell } from '@/components/layout';
import {
  InkBadge,
  InkButton,
  InkCard,
  InkDialog,
  InkNotice,
  type InkDialogState,
} from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { Material } from '@/types/cultivator';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export function ManualDrawContent() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type');
  const router = useRouter();
  const { cultivator, refresh } = useCultivator();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Material | null>(null);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);
  const [hasBuff, setHasBuff] = useState(false);
  const [checkingBuff, setCheckingBuff] = useState(false);

  const isSkill = type === 'skill';
  const typeName = isSkill ? '神通' : '功法';
  const pageTitle = isSkill ? '神通衍化' : '悟道演法';
  const buffId = isSkill ? 'draw_skill_talisman' : 'draw_gongfa_talisman';
  const talismanName = isSkill ? '神通衍化符' : '悟道演法符';

  // 从 API 获取当前 buff 状态
  const checkBuffStatus = useCallback(async () => {
    setCheckingBuff(true);
    try {
      const res = await fetch('/api/cultivator/talismans');
      const data = await res.json();
      if (data.talismans) {
        const buff = data.talismans.some(
          (t: { id: string }) => t.id === buffId,
        );
        setHasBuff(buff);
        return buff;
      }
      setHasBuff(false);
      return false;
    } catch (e) {
      console.error('获取符箓状态失败:', e);
      setHasBuff(false);
      return false;
    } finally {
      setCheckingBuff(false);
    }
  }, [buffId]);

  // 初始化时检查 buff 状态
  useEffect(() => {
    if (cultivator) {
      checkBuffStatus();
    }
  }, [cultivator, checkBuffStatus]);

  const handleDraw = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cultivator/manual/draw?type=${type}`, {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '感悟失败');
      }

      setResult(data.manual);
      refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setDialog({
        id: 'draw-error',
        title: '道心不稳',
        content: <p>{msg}</p>,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.push('/game');
  };

  if (!cultivator) return null;

  return (
    <InkPageShell
      title={pageTitle}
      subtitle="天道垂青，机缘所至"
      backHref="/game"
    >
      <div className="flex flex-col items-center space-y-8 py-12">
        {!result ? (
          <>
            <div className="animate-pulse text-8xl opacity-80">
              {isSkill ? '⚡' : '📜'}
            </div>

            <div className="max-w-xs space-y-2 text-center">
              <p className="text-lg font-bold">燃烧【{talismanName}】</p>
              <p className="text-sm opacity-70">
                神游太虚，感应天地法则。
                <br />
                可获天道赐福，得一部玄品以上{typeName}典籍。
              </p>
            </div>

            {hasBuff ? (
              <InkButton
                variant="primary"
                onClick={handleDraw}
                disabled={loading || checkingBuff}
                className="w-48"
              >
                {loading
                  ? '感应天机中...'
                  : checkingBuff
                    ? '检查道韵中...'
                    : isSkill
                      ? '衍化神通'
                      : '感悟天道'}
              </InkButton>
            ) : (
              <InkNotice className="border-amber-600/30 bg-amber-600/10 text-amber-600">
                你当前未拥有{talismanName}，无法{isSkill ? '衍化' : '感悟'}。
              </InkNotice>
            )}
          </>
        ) : (
          <div className="animate-in fade-in zoom-in w-full max-w-md space-y-6 duration-500">
            <InkNotice className="bg-emerald-600/10 text-emerald-600">
              福至心灵，机缘已至！
            </InkNotice>

            <InkCard>
              <div className="flex flex-col items-center space-y-4 p-6">
                <div className="text-6xl">📚</div>
                <div className="text-ink-primary text-2xl font-bold">
                  {result.name}
                </div>
                <div className="flex gap-2">
                  <span className="bg-ink/10 rounded px-2 py-0.5 text-sm">
                    <InkBadge tier={result.rank} />
                  </span>
                  <span className="bg-ink/10 rounded px-2 py-0.5 text-sm">
                    {result.element}
                  </span>
                </div>
                <p className="text-center leading-relaxed opacity-80">
                  {result.description}
                </p>
              </div>
            </InkCard>

            <InkButton
              variant="secondary"
              className="w-full"
              onClick={handleClose}
            >
              收纳于心（返回）
            </InkButton>
          </div>
        )}
      </div>

      <InkDialog dialog={dialog} onClose={() => setDialog(null)} />
    </InkPageShell>
  );
}
