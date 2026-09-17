import { InkButton } from '@app/components/ui/InkButton';
import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import type { ArenaSessionView } from '@shared/contracts/combatV6Arena';
import { CAPTURE_SKILL_ID } from '@shared/engine/combat-v6/beasts/progression';
import { useState, type ReactNode } from 'react';
import { CombatV6PetChoice } from './CombatV6PetChoice';
import { CombatV6SkillChoice } from './CombatV6SkillChoice';
import { CombatV6Status } from './CombatV6Status';
import { reasonText, skillNeedsTarget } from './presentation';
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
  clockOffset,
}: {
  clockOffset?: number;
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
  const skills =
    options?.skills.filter(
      (skill) =>
        skill.skillId !== CAPTURE_SKILL_ID &&
        (session.display?.skillDetails?.[skill.skillId]?.category ??
          'spell') === category,
    ) ?? [];
  const disabled = pending || playing || !!blockedReason;
  const ended = !playing && session.outcome;
  const timing = online ? (
    <CombatV6Status
      round={session.round}
      playing={playing}
      online={online}
      clockOffset={clockOffset}
    />
  ) : undefined;
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
            {!online && allowAbandon ? (
              <button
                className="cv6-text-button"
                disabled={disabled}
                onClick={onClose}
              >
                放弃战斗
              </button>
            ) : null}
          </div>
          <div className={capture ? 'cv6-actions has-capture' : 'cv6-actions'}>
            <button
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
                disabled={
                  disabled ||
                  !options?.canSubmit ||
                  !options.skills.some(
                    (skill) =>
                      skill.skillId !== CAPTURE_SKILL_ID &&
                      (session.display?.skillDetails?.[skill.skillId]
                        ?.category ?? 'spell') === group,
                  )
                }
                aria-haspopup="dialog"
                aria-pressed={
                  choice?.type === 'skill' &&
                  choice.skillId !== CAPTURE_SKILL_ID &&
                  (session.display?.skillDetails?.[choice.skillId!]?.category ??
                    'spell') === group
                }
                onClick={() => {
                  onCancel();
                  setCategory(group);
                }}
              >
                {group === 'spell' ? '神通' : '器诀'}
              </button>
            ))}
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
            <button
              disabled={disabled || !options?.canSubmit || !options.canDefend}
              onClick={() => void submit({ type: 'defend' })}
            >
              防御
            </button>
            <button
              disabled={
                disabled ||
                !options?.canSubmit ||
                !options.protectTargetIds.length
              }
              aria-pressed={choice?.type === 'protect'}
              onClick={() =>
                setAction({
                  type: 'protect',
                  name: '保护',
                  ids: options!.protectTargetIds,
                  count: 1,
                })
              }
            >
              保护
            </button>
            <button
              disabled={
                disabled ||
                !options?.canSubmit ||
                !(options.summonablePets?.length || options.canRecall)
              }
              aria-haspopup="dialog"
              onClick={() => {
                onCancel();
                setPetsOpen(true);
              }}
            >
              灵兽
            </button>
            {capture ? (
              <button
                disabled={disabled || !options?.canSubmit || !capture.ready}
                aria-pressed={choice?.skillId === CAPTURE_SKILL_ID}
                onClick={() => {
                  if (choice?.skillId === CAPTURE_SKILL_ID) {
                    onCancel();
                    return;
                  }
                  setAction({
                    type: 'skill',
                    name: `捕捉 · ${capture.costs.mp} 法力`,
                    skillId: capture.skillId,
                    ids: capture.selectableTargetIds,
                    count: 1,
                  });
                }}
              >
                捕捉
              </button>
            ) : null}
            <button
              disabled={disabled || !options?.canSubmit || !options.canFlee}
              onClick={() => void submit({ type: 'flee' })}
            >
              逃跑
            </button>
          </div>
          <div className="cv6-command-hint" aria-live="polite">
            {playing ? null : blockedReason ? (
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
                <button disabled={disabled} onClick={() => void onResolve()}>
                  继续战斗
                </button>
              </>
            ) : (
              ''
            )}
          </div>
        </>
      )}
      {category && !disabled && !ended ? (
        <CombatV6SkillChoice
          timing={timing}
          category={category}
          skills={skills}
          session={session}
          onClose={() => setCategory(undefined)}
          onSelect={(skill) => {
            setCategory(undefined);
            if (!skillNeedsTarget(skill, options?.unitId)) {
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
      ) : null}
      {petsOpen && !disabled && !ended ? (
        <CombatV6PetChoice
          timing={timing}
          session={session}
          onClose={() => setPetsOpen(false)}
          onRecall={() => {
            setPetsOpen(false);
            void submit({ type: 'recall' });
          }}
          onSummon={(petId) => {
            setPetsOpen(false);
            void submit({ type: 'summon', petId });
          }}
        />
      ) : null}
    </footer>
  );
}
