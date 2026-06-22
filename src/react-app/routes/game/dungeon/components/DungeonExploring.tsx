import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkTag } from '@app/components/ui/InkTag';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type {
  DungeonOptionCost,
  DungeonOption,
  DungeonRound,
  DungeonState,
} from '@shared/lib/dungeon/types';
import type { Cultivator } from '@shared/types/cultivator';
import { getResourceIcon } from '@shared/lib/gameConceptDisplay';
import {
  formatDungeonCostBodyCultivationFeedback,
  formatDungeonCostName,
  formatDungeonCostValue,
} from '@app/lib/dungeon/formatDungeonCost';
import { useState } from 'react';
import { DungeonRunPanel } from './DungeonRunPanel';

interface DungeonExploringProps {
  state: DungeonState;
  lastRound: DungeonRound | null;
  cultivator: Cultivator | null;
  displayResources?: CultivatorDisplaySnapshot['resources'];
  onAction: (option: DungeonOption) => Promise<unknown>;
  onQuit: () => Promise<boolean>;
  processing: boolean;
}

function OptionCostPreview({ costs }: { costs: DungeonOptionCost[] }) {
  if (costs.length === 0) {
    return <div className="text-ink-secondary mt-1 text-sm">代价: 无需代价</div>;
  }

  const bodyFeedbacks = costs
    .map(formatDungeonCostBodyCultivationFeedback)
    .filter((text): text is string => Boolean(text));

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1.5 text-xs">
        {costs.map((cost, index) => (
          <span
            key={`${cost.type}-${index}`}
            className="border-ink/15 bg-paper-dark inline-flex items-center gap-1 border border-dashed px-1.5 py-0.5"
          >
            <span>{getResourceIcon(cost.type)}</span>
            <span>{formatDungeonCostName(cost)}</span>
            <span className="text-crimson font-semibold">
              {formatDungeonCostValue(cost)}
            </span>
          </span>
        ))}
      </div>
      {bodyFeedbacks.map((text, index) => (
        <div
          key={`${text}-${index}`}
          className="text-wood text-xs leading-5"
        >
          {text}
        </div>
      ))}
    </div>
  );
}

export function DungeonExploring({
  state,
  lastRound,
  cultivator,
  displayResources,
  onAction,
  onQuit,
  processing,
}: DungeonExploringProps) {
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);

  if (!lastRound) {
    return null;
  }

  return (
    <div className="space-y-6 pb-28">
      <DungeonRunPanel
        state={state}
        cultivator={cultivator}
        displayResources={displayResources}
        onQuit={onQuit}
      />

      <InkCard className="mb-6 flex min-h-50 flex-col justify-center">
        <p className="text-ink leading-relaxed">
          {lastRound.scene_description}
        </p>
      </InkCard>

      <InkSection title="抉择时刻">
        <div className="space-y-3">
          {lastRound.interaction.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const costs = option.costPreview ?? option.costs ?? [];
            return (
              <InkChoiceButton
                key={option.id}
                layout="card"
                selected={isSelected}
                disabled={processing}
                onClick={() => setSelectedOptionId(option.id)}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <span
                    className={`flex-1 leading-tight font-bold ${isSelected ? 'text-crimson' : ''}`}
                  >
                    {option.text}
                  </span>
                  <InkTag
                    tone={
                      option.risk_level === 'high'
                        ? 'bad'
                        : option.risk_level === 'medium'
                          ? 'info'
                          : 'good'
                    }
                    variant="outline"
                    className="shrink-0 text-xs"
                  >
                    {option.risk_level === 'high'
                      ? '凶险'
                      : option.risk_level === 'medium'
                        ? '莫测'
                        : '稳健'}
                  </InkTag>
                </div>
                {option.requirement ? (
                  <div className="text-crimson mt-2 text-sm">
                    需: {option.requirement}
                  </div>
                ) : null}
                {option.potential_cost ? (
                  <div className="text-ink-secondary mt-1 text-sm">
                    提示: {option.potential_cost}
                  </div>
                ) : null}
                <OptionCostPreview costs={costs} />
              </InkChoiceButton>
            );
          })}
        </div>

        <InkButton
          variant="primary"
          className="mx-auto mt-4 block!"
          disabled={!selectedOptionId || processing}
          onClick={async () => {
            const option = lastRound.interaction.options.find(
              (item) => item.id === selectedOptionId,
            );
            if (option) {
              await onAction(option);
            }
            setSelectedOptionId(null);
          }}
        >
          {processing ? '推演中...' : '确定抉择'}
        </InkButton>
      </InkSection>

      {state.history.length > 0 ? (
        <InkSection title="回顾前路" subdued>
          <div className="text-ink-secondary max-h-40 space-y-2 overflow-y-auto px-2 text-sm">
            {state.history.map((history, index) => (
              <div key={index} className="border-ink/10 border-l-2 pl-2">
                <div className="font-bold">第{history.round}回</div>
                <div>{history.scene.substring(0, 50)}...</div>
                {history.choice ? (
                  <div className="text-crimson">➜ {history.choice}</div>
                ) : null}
                {history.gained_items && history.gained_items.length > 0 ? (
                  <div className="text-wood mt-0.5 text-xs">
                    获得: {history.gained_items.join(', ')}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </InkSection>
      ) : null}
    </div>
  );
}
