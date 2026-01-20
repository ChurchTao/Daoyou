'use client';

import { InkPageShell } from '@/components/layout';
import { InkButton, InkCard, InkNotice, InkDialog, type InkDialogState } from '@/components/ui';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Material } from '@/types/cultivator';
import type { BuffInstanceState } from '@/engine/buff/types';

export default function ManualDrawPage() {
  const searchParams = useSearchParams();
  const type = searchParams.get('type');
  const router = useRouter();
  const { cultivator, refresh } = useCultivator();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Material | null>(null);
  const [dialog, setDialog] = useState<InkDialogState | null>(null);

  const typeName = type === 'skill' ? '神通' : '功法';
  const buffId = type === 'skill' ? 'draw_skill_talisman' : 'draw_gongfa_talisman';

  const persistentStatuses = (cultivator?.persistent_statuses || []) as BuffInstanceState[];
  const hasBuff = persistentStatuses.some(
    (s) => s.configId === buffId
  );

  const handleDraw = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cultivator/manual/draw?type=${type}`, {
        method: 'POST',
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || '抽取失败');
      }

      setResult(data.manual);
      refresh();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '未知错误';
      setDialog({
        id: 'draw-error',
        title: '提示',
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
      title={`${typeName}抽取`}
      subtitle="天道垂青，机缘所至"
      backHref="/game"
    >
      <div className="flex flex-col items-center py-12 space-y-8">
        {!result ? (
          <>
            <div className="text-8xl animate-pulse opacity-80">
              {type === 'skill' ? '⚡' : '📜'}
            </div>
            
            <div className="text-center space-y-2 max-w-xs">
              <p className="text-lg font-bold">
                消耗{typeName}抽取符
              </p>
              <p className="opacity-70 text-sm">
                可随机获得一本玄品及以上品质的{typeName}典籍。<br/>
                如果不满意，那是天意。
              </p>
            </div>

            {hasBuff ? (
              <InkButton 
                variant="primary" 
                onClick={handleDraw}
                disabled={loading}
                className="w-48"
              >
                {loading ? '感应天机中...' : '立即抽取'}
              </InkButton>
            ) : (
              <InkNotice className="text-amber-600 border-amber-600/30 bg-amber-600/10">
                你当前未拥有{typeName}抽取符，无法抽取。
              </InkNotice>
            )}
          </>
        ) : (
          <div className="w-full max-w-md space-y-6 animate-in fade-in zoom-in duration-500">
            <InkNotice className="text-center text-emerald-600 border-emerald-600/30 bg-emerald-600/10">
              恭喜获得新的机缘！
            </InkNotice>
            
            <InkCard>
              <div className="flex flex-col items-center p-6 space-y-4">
                <div className="text-6xl">📚</div>
                <div className="text-2xl font-bold font-serif text-ink-primary">
                  {result.name}
                </div>
                <div className="flex gap-2">
                  <span className="bg-ink/10 px-2 py-0.5 rounded text-sm">
                    {result.rank}
                  </span>
                  <span className="bg-ink/10 px-2 py-0.5 rounded text-sm">
                    {result.element}
                  </span>
                </div>
                <p className="text-center opacity-80 leading-relaxed">
                  {result.description}
                </p>
              </div>
            </InkCard>

            <InkButton 
              variant="secondary" 
              className="w-full"
              onClick={handleClose}
            >
              收入囊中（返回）
            </InkButton>
          </div>
        )}
      </div>

      <InkDialog
        dialog={dialog}
        onClose={() => setDialog(null)}
      />
    </InkPageShell>
  );
}