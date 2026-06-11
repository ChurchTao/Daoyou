import { InkButton } from '@app/components/ui/InkButton';
import { useActiveCultivatorProfile } from '@app/lib/player-state/selectors';
import { usePlayerStateActions } from '@app/lib/player-state/store';
import { cn } from '@shared/lib/cn';
import type {
  PlayerSettingsResponse,
  UpdatePlayerSettingsRequest,
} from '@shared/contracts/playerSettings';
import {
  BATTLE_ABILITY_STRATEGY_MODES,
  DEFAULT_BATTLE_ABILITY_STRATEGY_SETTINGS,
  normalizeBattleAbilityStrategySettings,
  type BattleAbilityStrategySettings,
} from '@shared/types/gameSettings';
import { useEffect, useState } from 'react';
import {
  SettingsField,
  SettingsMessage,
  SettingsSection,
  SettingsToggle,
} from './SettingsFields';
import { formatDateTime } from './utils';

const MODE_LABELS: Record<BattleAbilityStrategySettings['mode'], string> = {
  balanced: '均衡',
  aggressive: '进攻',
  conservative: '稳健',
};

const MODE_DESCRIPTIONS: Record<BattleAbilityStrategySettings['mode'], string> = {
  balanced: '按默认战斗权重施放技能',
  aggressive: '提高伤害与收割倾向',
  conservative: '更早保留气血与护盾',
};

function toPercent(value: number): number {
  return Math.round(value * 100);
}

function StrategyLabel({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3">
      <span className="text-battle-muted min-w-0 text-[0.72rem] tracking-[0.18em]">
        {label}
      </span>
      {value ? (
        <span className="text-ink shrink-0 font-mono text-sm">{value}</span>
      ) : null}
    </div>
  );
}

function StrategyRange({
  label,
  value,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2">
      <StrategyLabel label={label} value={`${value}%`} />
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-center gap-3">
        <span className="text-battle-muted text-xs">{min}%</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          disabled={disabled}
          className={cn(
            'h-1.5 w-full cursor-pointer appearance-none bg-transparent',
            '[&::-webkit-slider-runnable-track]:border-ink/15 [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:border [&::-webkit-slider-runnable-track]:bg-ink/8',
            '[&::-webkit-slider-thumb]:border-bgpaper [&::-webkit-slider-thumb]:bg-crimson [&::-webkit-slider-thumb]:mt-[-5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:border-2',
            '[&::-moz-range-track]:border-ink/15 [&::-moz-range-track]:h-1.5 [&::-moz-range-track]:border [&::-moz-range-track]:bg-ink/8',
            '[&::-moz-range-thumb]:border-bgpaper [&::-moz-range-thumb]:bg-crimson [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:border-2',
            disabled && 'cursor-not-allowed opacity-50',
          )}
        />
        <span className="text-battle-muted text-right text-xs">{max}%</span>
      </div>
    </label>
  );
}

export function GameSettingsTab() {
  const cultivator = useActiveCultivatorProfile();
  const { mutate } = usePlayerStateActions();
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [strategy, setStrategy] = useState<BattleAbilityStrategySettings>(() =>
    normalizeBattleAbilityStrategySettings(
      cultivator?.gameSettings?.battleAbilityStrategy,
    ),
  );
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const cultivatorId = cultivator?.id ?? '';

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      setIsLoadingSettings(true);
      try {
        const response = await fetch('/api/player/settings');
        const json = (await response.json()) as PlayerSettingsResponse;
        if (!response.ok || !json.success) {
          throw new Error(
            'error' in json && typeof json.error === 'string'
              ? json.error
              : '读取战斗策略失败',
          );
        }
        if (!isMounted) return;
        setStrategy(
          normalizeBattleAbilityStrategySettings(
            json.data.battleAbilityStrategy,
          ),
        );
      } catch (error) {
        if (!isMounted) return;
        setSettingsMessage(
          error instanceof Error ? error.message : '读取战斗策略失败',
        );
      } finally {
        if (isMounted) {
          setIsLoadingSettings(false);
        }
      }
    };

    if (cultivatorId) {
      loadSettings();
    }

    return () => {
      isMounted = false;
    };
  }, [cultivatorId]);

  const handleCopyCultivatorId = async () => {
    if (!cultivatorId) return;

    try {
      await navigator.clipboard.writeText(cultivatorId);
      setCopyMessage('已复制');
    } catch {
      setCopyMessage('复制失败');
    }
  };

  const updateStrategy = (
    patch: Partial<BattleAbilityStrategySettings>,
  ): void => {
    setStrategy((current) =>
      normalizeBattleAbilityStrategySettings({
        ...current,
        ...patch,
      }),
    );
    setSettingsMessage(null);
  };

  const handleSaveStrategy = async () => {
    if (!cultivatorId) return;

    setIsSavingSettings(true);
    setSettingsMessage(null);
    try {
      const payload: UpdatePlayerSettingsRequest = {
        gameSettings: {
          battleAbilityStrategy: strategy,
        },
      };
      const updated = await mutate<PlayerSettingsResponse['data']>(
        fetch('/api/player/settings', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }),
      );
      setStrategy(
        normalizeBattleAbilityStrategySettings(
          updated.battleAbilityStrategy,
        ),
      );
      setSettingsMessage('战斗策略已保存');
    } catch (error) {
      setSettingsMessage(
        error instanceof Error ? error.message : '保存战斗策略失败',
      );
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleResetStrategy = () => {
    setStrategy({ ...DEFAULT_BATTLE_ABILITY_STRATEGY_SETTINGS });
    setSettingsMessage(null);
  };

  return (
    <div className="space-y-6">
      <SettingsSection>
        <SettingsField
          label="角色 ID"
          value={cultivatorId || '—'}
          mono
          action={
            cultivatorId ? (
              <InkButton variant="secondary" onClick={handleCopyCultivatorId}>
                复制
              </InkButton>
            ) : null
          }
        />
        <SettingsField
          label="角色创建时间"
          value={formatDateTime(cultivator?.createdAt)}
        />
      </SettingsSection>
      <SettingsSection
        title="战斗技能策略"
        description="当前角色自动战斗时的技能取舍。"
        aside={
          isLoadingSettings ? (
            <span className="text-battle-muted text-sm">读取中</span>
          ) : null
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <StrategyLabel label="策略模式" />
            <div className="grid gap-2 md:grid-cols-3">
              {BATTLE_ABILITY_STRATEGY_MODES.map((mode) => {
                const selected = strategy.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => updateStrategy({ mode })}
                    disabled={
                      !cultivatorId || isLoadingSettings || isSavingSettings
                    }
                    aria-pressed={selected}
                    className={cn(
                      'border-ink/15 bg-bgpaper/60 min-w-0 border border-dashed px-3 py-2 text-left transition-colors',
                      'hover:border-crimson/45 hover:text-crimson',
                      selected &&
                        'border-crimson/45 bg-crimson/6 text-crimson',
                      (!cultivatorId ||
                        isLoadingSettings ||
                        isSavingSettings) &&
                        'cursor-not-allowed opacity-50',
                    )}
                  >
                    <span className="block text-sm font-semibold tracking-[0.08em]">
                      {MODE_LABELS[mode]}
                    </span>
                    <span
                      className={cn(
                        'mt-1 block text-xs leading-5',
                        selected ? 'text-crimson/75' : 'text-ink-secondary',
                      )}
                    >
                      {MODE_DESCRIPTIONS[mode]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-ink/10 grid gap-4 border-t border-dashed pt-4">
            <StrategyRange
              label="HP 高于此值不使用治疗"
              value={toPercent(strategy.healHpSkipThreshold)}
              min={40}
              max={100}
              step={5}
              disabled={!cultivatorId || isLoadingSettings || isSavingSettings}
              onChange={(value) =>
                updateStrategy({ healHpSkipThreshold: value / 100 })
              }
            />

            <StrategyRange
              label="HP 低于此值视为紧急治疗"
              value={toPercent(strategy.emergencyHealHpThreshold)}
              min={10}
              max={80}
              step={5}
              disabled={!cultivatorId || isLoadingSettings || isSavingSettings}
              onChange={(value) =>
                updateStrategy({ emergencyHealHpThreshold: value / 100 })
              }
            />

            <StrategyRange
              label="MP 高于此值不使用回蓝"
              value={toPercent(strategy.restoreMpSkipThreshold)}
              min={25}
              max={100}
              step={5}
              disabled={!cultivatorId || isLoadingSettings || isSavingSettings}
              onChange={(value) =>
                updateStrategy({ restoreMpSkipThreshold: value / 100 })
              }
            />
          </div>

          <div className="border-ink/10 border-t border-dashed pt-4">
            <SettingsToggle
              checked={strategy.avoidRepeatControl}
              onChange={(checked) =>
                updateStrategy({ avoidRepeatControl: checked })
              }
              disabled={!cultivatorId || isLoadingSettings || isSavingSettings}
              label="避免重复控制"
              description="目标已有控制或免控时，优先把行动留给伤害与防御技能。"
            />
          </div>

          <div className="border-ink/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-dashed pt-3">
            <div className="min-h-6 min-w-0">
              {copyMessage ? (
                <SettingsMessage>{copyMessage}</SettingsMessage>
              ) : settingsMessage ? (
                <SettingsMessage
                  type={settingsMessage.includes('失败') ? 'error' : 'muted'}
                >
                  {settingsMessage}
                </SettingsMessage>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <InkButton
                variant="primary"
                onClick={handleSaveStrategy}
                disabled={
                  !cultivatorId || isLoadingSettings || isSavingSettings
                }
              >
                {isSavingSettings ? '保存中' : '保存策略'}
              </InkButton>
              <InkButton
                variant="secondary"
                onClick={handleResetStrategy}
                disabled={
                  !cultivatorId || isLoadingSettings || isSavingSettings
                }
              >
                恢复默认
              </InkButton>
            </div>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}
