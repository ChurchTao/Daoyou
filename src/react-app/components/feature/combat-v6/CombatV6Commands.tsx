import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import { useState } from 'react';
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
const outcomeLabels = {
  victory: '胜利',
  defeat: '落败',
  draw: '平局',
  aborted: '已离场',
};
export function CombatV6Commands({
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
  onClose,
}: {
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
  onClose: () => void;
}) {
  const options = session.commandOptions;
  const [category, setCategory] = useState<'spell' | 'art'>();
  const skills =
    options?.skills.filter(
      (skill) =>
        (session.display?.skillDetails?.[skill.skillId]?.category ??
          'spell') === category,
    ) ?? [];
  const disabled = pending || playing;
  const ended = !playing && session.outcome;
  return (
    <footer className="cv6-command">
      {ended ? (
        <div className="cv6-command-heading">
          <strong>{outcomeLabels[ended]}</strong>
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
            <strong>{playing ? '战斗进行中' : unitName}</strong>
            <button
              className="cv6-text-button"
              disabled={disabled}
              onClick={onClose}
            >
              放弃战斗
            </button>
          </div>
          {!playing && (
            <>
              <div className="cv6-actions">
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
                    disabled={disabled}
                    aria-haspopup="dialog"
                    aria-pressed={
                      choice?.type === 'skill' &&
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
                {options?.canFlee && (
                  <button
                    disabled={disabled}
                    onClick={() => void submit({ type: 'flee' })}
                  >
                    逃跑
                  </button>
                )}
              </div>
              <div className="cv6-command-hint" aria-live="polite">
                {pending ? (
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
                  '选择行动'
                )}
              </div>
            </>
          )}
        </>
      )}
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
    </footer>
  );
}
