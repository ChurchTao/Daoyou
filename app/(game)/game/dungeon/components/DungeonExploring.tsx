import { DungeonProgressCard } from '@/components/dungeon/DungeonProgressCard';
import { InkPageShell, InkSection } from '@/components/layout';
import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { InkTag } from '@/components/ui/InkTag';
import { DungeonOption, DungeonRound, DungeonState } from '@/lib/dungeon/types';
import { useState } from 'react';

interface DungeonExploringProps {
  state: DungeonState;
  lastRound: DungeonRound | null;
  onAction: (option: DungeonOption) => Promise<unknown>;
  onQuit: () => Promise<boolean>;
  processing: boolean;
}

/**
 * 副本探索组件
 * 显示场景、选项和历史记录
 */
export function DungeonExploring({
  state,
  lastRound,
  onAction,
  onQuit,
  processing,
}: DungeonExploringProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);

  if (!lastRound) {
    return null;
  }

  return (
    <InkPageShell title={state.theme} backHref="/game">
      {/* 场景描述 */}
      <InkCard className="mb-6 flex min-h-[200px] flex-col justify-center">
        <p className="text-ink leading-relaxed">
          {lastRound.scene_description}
        </p>
      </InkCard>

      {/* 副本状态和进度 */}
      <DungeonProgressCard state={state} onQuit={onQuit} />

      {/* 选项列表 */}
      <InkSection title="抉择时刻">
        <div className="space-y-3">
          {lastRound.interaction.options.map((opt: DungeonOption) => {
            const isSelected = selectedOptionId === opt.id;
            return (
              <button
                key={opt.id}
                disabled={processing}
                onClick={() => setSelectedOptionId(opt.id)}
                className={`w-full rounded border p-4 text-left transition-all ${
                  isSelected
                    ? 'border-crimson bg-crimson/5 ring-crimson ring-1'
                    : 'border-ink/20 bg-paper hover:border-crimson hover:bg-paper-dark'
                } ${processing ? 'cursor-not-allowed opacity-50' : ''} `}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <span
                    className={`flex-1 leading-tight font-bold ${isSelected ? 'text-crimson' : ''}`}
                  >
                    {opt.text}
                  </span>
                  <InkTag
                    tone={
                      opt.risk_level === 'high'
                        ? 'bad'
                        : opt.risk_level === 'medium'
                          ? 'info'
                          : 'good'
                    }
                    variant="outline"
                    className="shrink-0 text-xs"
                  >
                    {opt.risk_level === 'high'
                      ? '凶险'
                      : opt.risk_level === 'medium'
                        ? '莫测'
                        : '稳健'}
                  </InkTag>
                </div>
                {opt.requirement && (
                  <div className="text-crimson mt-2 text-sm">
                    需: {opt.requirement}
                  </div>
                )}
                {opt.potential_cost && (
                  <div className="text-ink-secondary mt-1 text-sm">
                    代价: {opt.potential_cost}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <InkButton
          variant="primary"
          className="mx-auto mt-4 block!"
          disabled={!selectedOptionId || processing}
          onClick={async () => {
            const opt = lastRound.interaction.options.find(
              (o) => o.id === selectedOptionId,
            );
            if (opt) await onAction(opt);
            setSelectedOptionId(null);
          }}
        >
          {processing ? '推演中...' : '确定抉择'}
        </InkButton>
      </InkSection>

      {/* 历史记录 */}
      {state.history.length > 0 && (
        <InkSection title="回顾前路" subdued>
          <div className="text-ink-secondary max-h-40 space-y-2 overflow-y-auto px-2 text-sm">
            {state.history.map((h, i) => (
              <div key={i} className="border-ink/10 border-l-2 pl-2">
                <div className="font-bold">第{h.round}回</div>
                <div>{h.scene.substring(0, 50)}...</div>
                {h.choice && <div className="text-crimson">➜ {h.choice}</div>}
              </div>
            ))}
          </div>
        </InkSection>
      )}
    </InkPageShell>
  );
}
