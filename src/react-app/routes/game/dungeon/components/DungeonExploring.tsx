import { InkSection } from '@app/components/layout';
import { InkButton } from '@app/components/ui/InkButton';
import { InkCard } from '@app/components/ui/InkCard';
import { InkChoiceButton } from '@app/components/ui/InkChoiceButton';
import { InkTag } from '@app/components/ui/InkTag';
import { TypewriterText } from '@app/components/ui/TypewriterText';
import {
  formatDungeonCostBodyCultivationFeedback,
  formatDungeonCostName,
  formatDungeonCostValue,
} from '@app/lib/dungeon/formatDungeonCost';
import type { CultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type {
  DungeonOption,
  DungeonOptionCost,
  DungeonRound,
  DungeonState,
} from '@shared/lib/dungeon/types';
import { getResourceIcon } from '@shared/lib/gameConceptDisplay';
import type { Cultivator } from '@shared/types/cultivator';
import { useState } from 'react';
import { formatDungeonText } from '../formatDungeonText';
import { DungeonRunPanel } from './DungeonRunPanel';

const MAX_REVEALED_OPTIONS = 3;
const SCENE_TYPEWRITER_SPEED_MS = 45;

interface DungeonExploringProps {
  state: DungeonState;
  lastRound: DungeonRound | null;
  cultivator: Pick<Cultivator, 'realm' | 'condition'> | null;
  displayResources?: CultivatorDisplaySnapshot['resources'];
  onAction: (option: DungeonOption) => Promise<unknown>;
  onQuit: () => Promise<boolean>;
  processing: boolean;
}

function OptionCostPreview({ costs }: { costs: DungeonOptionCost[] }) {
  if (costs.length === 0) {
    return (
      <div className="text-ink-secondary mt-1 text-sm">代价: 无需代价</div>
    );
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
        <div key={`${text}-${index}`} className="text-wood text-xs leading-5">
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
  const [sceneComplete, setSceneComplete] = useState(false);
  const [choicesVisible, setChoicesVisible] = useState(false);
  const [revealedOptionCount, setRevealedOptionCount] = useState(1);

  if (!lastRound) {
    return null;
  }

  const availableOptions = lastRound.interaction.options.slice(
    0,
    MAX_REVEALED_OPTIONS,
  );
  const visibleOptions = availableOptions.slice(0, revealedOptionCount);
  const canRevealMore = revealedOptionCount < availableOptions.length;

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
          <TypewriterText
            text={formatDungeonText(lastRound.scene_description)}
            speed={SCENE_TYPEWRITER_SPEED_MS}
            showCursor
            onComplete={() => setSceneComplete(true)}
          />
        </p>
        {sceneComplete && !choicesVisible ? (
          <InkButton
            variant="primary"
            className="mx-auto mt-6"
            onClick={() => setChoicesVisible(true)}
          >
            下一步
          </InkButton>
        ) : null}
      </InkCard>

      {choicesVisible ? (
        <InkSection title="抉择时刻">
          <div className="space-y-3">
            {visibleOptions.map((option) => {
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
                      {formatDungeonText(option.text)}
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
                      需: {formatDungeonText(option.requirement)}
                    </div>
                  ) : null}
                  {option.potential_cost ? (
                    <div className="text-ink-secondary mt-1 text-sm">
                      提示: {formatDungeonText(option.potential_cost)}
                    </div>
                  ) : null}
                  <OptionCostPreview costs={costs} />
                </InkChoiceButton>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {canRevealMore ? (
              <InkButton
                variant="secondary"
                disabled={processing}
                onClick={() =>
                  setRevealedOptionCount((count) =>
                    Math.min(count + 1, availableOptions.length),
                  )
                }
              >
                下一个
              </InkButton>
            ) : null}
            <InkButton
              variant="primary"
              disabled={!selectedOptionId}
              pending={processing}
              pendingLabel="推演中……"
              onClick={async () => {
                const option = availableOptions.find(
                  (item) => item.id === selectedOptionId,
                );
                if (option) {
                  await onAction(option);
                }
                setSelectedOptionId(null);
              }}
            >
              确定抉择
            </InkButton>
          </div>
        </InkSection>
      ) : null}

      {choicesVisible && state.history.length > 0 ? (
        <InkSection title="回顾前路" subdued>
          <div className="text-ink-secondary max-h-40 space-y-2 overflow-y-auto px-2 text-sm">
            {state.history.map((history, index) => (
              <div key={index} className="border-ink/10 border-l-2 pl-2">
                <div className="font-bold">第{history.round}回</div>
                <div>
                  {formatDungeonText(history.scene).substring(0, 50)}...
                </div>
                {history.choice ? (
                  <div className="text-crimson">
                    ➜ {formatDungeonText(history.choice)}
                  </div>
                ) : null}
                {history.actual_costs && history.actual_costs.length > 0 ? (
                  <div className="text-ink-secondary text-xs">
                    实际消耗：{history.actual_costs.join('、')}
                  </div>
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
