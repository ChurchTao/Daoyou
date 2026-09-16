import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import type { ArenaSessionView } from '@shared/contracts/combatV6Arena';
import { CAPTURE_SKILL_ID } from '@shared/engine/combat-v6/beasts/progression';
import { useState, type ReactNode } from 'react';
import { CombatV6SkillChoice } from './CombatV6SkillChoice';
import { reasonText } from './presentation';
import type { CombatV6Session } from './session';
export type Choice = {
  name: string;
  type: 'attack' | 'protect' | 'skill';
  ids: string[];
  count: number;
  skillId?: string;
};
export function CombatV6Commands({
  allowAbandon = true,
  online,
  session,
  playing,
  pending,
  unitName,
  choice,
  targets,
  setAction,
  onCancel,
  submit,
  onResolve,
  onAuto,
  autoEnabled,
  onClose,
  steps,
  commandError,
  blockedReason,
  onRetryCommand,
}: {
  allowAbandon?: boolean;
  online?: ArenaSessionView;
  session: CombatV6Session;
  playing: boolean;
  pending: boolean;
  unitName: string;
  choice?: Choice;
  targets: string[];
  setAction: (choice: Choice) => void;
  onCancel: () => void;
  submit: (command: CombatV6TrainingCommandV1) => Promise<void>;
  onResolve: () => Promise<void>;
  onAuto: () => void;
  autoEnabled: boolean;
  onClose: () => void;
  steps?: ReactNode;
  commandError?: string;
  blockedReason?: string;
  onRetryCommand?: () => void;
}) {
  const options = session.commandOptions;
  const capture = options?.skills.find(
    (skill) => skill.skillId === CAPTURE_SKILL_ID,
  );
  const [category, setCategory] = useState<'spell' | 'art'>();
  const [petsOpen, setPetsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const skills =
    options?.skills.filter(
      (skill) =>
        skill.skillId !== CAPTURE_SKILL_ID &&
        (session.display?.skillDetails?.[skill.skillId]?.category ??
          'spell') === category,
    ) ?? [];
  const disabled = pending || playing || !!blockedReason;
  const ended = !playing && session.outcome;
  return (
    <footer className="cv6-command">
      {ended ? (
        <div className="cv6-command-heading">
          <strong>本场战斗结束</strong>
          <span className="cv6-muted">
            {session.settlement === 'pending'
              ? '资源结算中……'
              : session.settlement === 'settled'
                ? '资源已结算'
                : ''}
          </span>
          <InkButton
            pending={pending}
            disabled={session.settlement === 'pending'}
            onClick={onClose}
          >
            结束本次战斗
          </InkButton>
        </div>
      ) : (
        <>
          <div className="cv6-command-heading">
            {steps ?? <strong>{playing ? '战斗进行中' : unitName}</strong>}
            <button
              disabled={!!session.outcome || (pending && !autoEnabled)}
              aria-pressed={autoEnabled}
              onClick={() => {
                onCancel();
                onAuto();
              }}
            >
              {autoEnabled ? '取消自动' : '自动'}
            </button>
            {(options?.canFlee || (!online && allowAbandon)) && !playing ? (
              <button
                className="cv6-text-button"
                aria-haspopup="dialog"
                disabled={disabled}
                onClick={() => setMoreOpen(true)}
              >
                更多
              </button>
            ) : null}
          </div>
          {!playing && (
            <>
              <div className="cv6-actions">
                <button
                  className="cv6-primary-action"
                  disabled={
                    disabled ||
                    !options?.canSubmit ||
                    !options.attackTargetIds.length
                  }
                  onClick={() =>
                    setAction({
                      type: 'attack',
                      name: '攻击',
                      ids: options!.attackTargetIds,
                      count: 1,
                    })
                  }
                  aria-pressed={choice?.type === 'attack'}
                >
                  攻击
                </button>
                {(['spell', 'art'] as const).map((group) => (
                  <button
                    key={group}
                    className="cv6-primary-action"
                    disabled={disabled || (!!online && !options)}
                    aria-haspopup="dialog"
                    aria-pressed={
                      choice?.type === 'skill' &&
                      choice.skillId !== CAPTURE_SKILL_ID &&
                      (session.display?.skillDetails?.[choice.skillId!]
                        ?.category ?? 'spell') === group
                    }
                    onClick={() => {
                      onCancel();
                      setCategory(group);
                    }}
                  >
                    {group === 'spell' ? '神通' : '器诀'}
                  </button>
                ))}
                {capture ? (
                  <span className="cv6-capture-action">
                    <button
                      disabled={disabled || !capture.ready}
                      aria-pressed={choice?.skillId === CAPTURE_SKILL_ID}
                      onClick={() =>
                        setAction({
                          type: 'skill',
                          name: `捕捉 · ${capture.costs.mp} 法力`,
                          skillId: capture.skillId,
                          ids: capture.selectableTargetIds,
                          count: 1,
                        })
                      }
                    >
                      捕捉
                    </button>
                    <InkTooltip label="查看捕捉说明">
                      执行时消耗法力，失败也会消耗。目标失效会自动转向可捕捉灵兽；持有已满或未达到携带境界时不能捕捉。
                      {capture.costs.mp
                        ? ` 当前目标消耗 ${capture.costs.mp} MP。`
                        : ''}
                      {!capture.ready
                        ? capture.reasons.map(reasonText).join('；')
                        : ''}
                    </InkTooltip>
                  </span>
                ) : null}
                {options?.canDefend && (
                  <button
                    disabled={disabled}
                    onClick={() => void submit({ type: 'defend' })}
                  >
                    防御
                  </button>
                )}
                {!!options?.protectTargetIds.length && (
                  <button
                    disabled={disabled || !options.canSubmit}
                    aria-pressed={choice?.type === 'protect'}
                    onClick={() =>
                      setAction({
                        type: 'protect',
                        name: '保护',
                        ids: options.protectTargetIds,
                        count: 1,
                      })
                    }
                  >
                    保护
                  </button>
                )}
                {(!!options?.summonablePets?.length || options?.canRecall) && (
                  <button
                    disabled={disabled}
                    onClick={() => {
                      onCancel();
                      setPetsOpen(true);
                    }}
                  >
                    灵兽
                  </button>
                )}
              </div>
              <div className="cv6-command-hint" aria-live="polite">
                {blockedReason ? (
                  <>
                    {blockedReason}
                    {onRetryCommand ? (
                      <button disabled={pending} onClick={onRetryCommand}>
                        重试原指令
                      </button>
                    ) : null}
                  </>
                ) : commandError ? (
                  <span role="alert">{commandError}</span>
                ) : pending ? (
                  '正在提交……'
                ) : choice ? (
                  <>
                    {choice.name} · 选择目标
                    {choice.count > 1
                      ? `（${targets.length}/${choice.count}）`
                      : ''}
                    <button
                      onClick={() => {
                        onCancel();
                      }}
                    >
                      取消
                    </button>
                  </>
                ) : online ? (
                  online.submittedUnitIds.includes(online.controlledUnitId) ? (
                    '已提交，等待其他人物下令'
                  ) : online.stage === 'collecting' && options?.canSubmit ? (
                    ''
                  ) : (
                    '等待战斗推进'
                  )
                ) : session.pendingCommand ? (
                  <button disabled={disabled} onClick={() => void onResolve()}>
                    继续执行已提交指令
                  </button>
                ) : options && !options.canSubmit ? (
                  <>
                    {options.reasons.map(reasonText).join('；')}
                    <button
                      disabled={disabled}
                      onClick={() => void onResolve()}
                    >
                      继续战斗
                    </button>
                  </>
                ) : (
                  ''
                )}
              </div>
            </>
          )}
        </>
      )}
      {moreOpen && !disabled && !ended ? (
        <InkDetailDrawer
          isOpen
          title="其他行动"
          size="sm"
          onClose={() => setMoreOpen(false)}
        >
          {options?.canFlee ? (
            <InkButton
              onClick={() => {
                setMoreOpen(false);
                void submit({ type: 'flee' });
              }}
            >
              逃跑
            </InkButton>
          ) : null}
          {!online && allowAbandon ? (
            <InkButton
              variant="secondary"
              onClick={() => {
                setMoreOpen(false);
                onClose();
              }}
            >
              放弃战斗
            </InkButton>
          ) : null}
        </InkDetailDrawer>
      ) : null}
      {category && !disabled && !ended ? (
        <InkDetailDrawer
          isOpen
          title={category === 'spell' ? '神通' : '器诀'}
          size="sm"
          onClose={() => setCategory(undefined)}
        >
          <div className="cv6-skill-list">
            {skills.length ? (
              skills.map((skill) => (
                <CombatV6SkillChoice
                  key={skill.skillId}
                  skill={skill}
                  detail={
                    session.display?.skillDetails?.[skill.skillId]?.description
                  }
                  resources={
                    session.units.find((unit) => unit.id === options?.unitId)
                      ?.resources ?? []
                  }
                  onSelect={() => {
                    setCategory(undefined);
                    if (
                      ['all', 'random', 'lowestHp', 'lowestDef'].includes(
                        skill.targetMode,
                      ) ||
                      (skill.selectableTargetIds.length === 1 &&
                        skill.selectableTargetIds[0] === options?.unitId)
                    ) {
                      void submit({
                        type: 'skill',
                        skillId: skill.skillId,
                        targets: skill.selectableTargetIds.slice(0, 1),
                      });
                    } else {
                      setAction({
                        type: 'skill',
                        name: skill.name,
                        skillId: skill.skillId,
                        ids: skill.selectableTargetIds,
                        count:
                          skill.targetMode === 'explicit'
                            ? Math.min(
                                skill.targetCount,
                                skill.selectableTargetIds.length,
                              )
                            : 1,
                      });
                    }
                  }}
                />
              ))
            ) : (
              <p className="cv6-muted">
                暂无可用{category === 'spell' ? '神通' : '器诀'}
              </p>
            )}
          </div>
        </InkDetailDrawer>
      ) : null}
      {petsOpen && !disabled && !ended ? (
        <InkDetailDrawer
          isOpen
          title="灵兽"
          size="sm"
          onClose={() => setPetsOpen(false)}
        >
          <div className="cv6-skill-list">
            {options?.canRecall ? (
              <InkButton
                onClick={() => {
                  setPetsOpen(false);
                  void submit({ type: 'recall' });
                }}
              >
                召回当前灵兽
              </InkButton>
            ) : null}
            {options?.summonablePets?.map((pet) => (
              <button
                key={pet.id}
                onClick={() => {
                  setPetsOpen(false);
                  void submit({ type: 'summon', petId: pet.id });
                }}
              >
                <GameIcon
                  value={
                    session.display?.unitAppearances?.[pet.id]?.icon ?? '🐾'
                  }
                />
                {pet.name}{' '}
                <span className="cv6-muted">
                  气血{' '}
                  <span className="font-mono">
                    {Math.floor((pet.hp / pet.maxHp) * 100)}%
                  </span>{' '}
                  · 法力{' '}
                  <span className="font-mono">
                    {Math.floor((pet.mp / Math.max(1, pet.maxMp)) * 100)}%
                  </span>
                </span>
              </button>
            ))}
          </div>
        </InkDetailDrawer>
      ) : null}
    </footer>
  );
}
