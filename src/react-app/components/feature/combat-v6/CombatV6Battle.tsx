import { GameIcon } from '@app/components/ui/GameIcon';
import { AUTO_DELAY_MS } from '@shared/combat-v6/auto';
import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import type { ArenaSessionView } from '@shared/contracts/combatV6Arena';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CombatV6Commands, type Choice } from './CombatV6Commands';
import { CombatV6Details } from './CombatV6Details';
import { CombatV6Log } from './CombatV6Log';
import { CombatV6Roster } from './CombatV6Roster';
import { CombatV6Status } from './CombatV6Status';
import { frameFeedback, unitLabels } from './presentation';
import type { CombatV6Session, SessionState } from './session';

type Props = {
  allowAbandon?: boolean;
  online?: ArenaSessionView;
  connected?: boolean;
  onRetryCommand?: () => void;
  clockOffset?: number;
  title: string;
  session: CombatV6Session;
  shown: SessionState<CombatV6Session>['shown'];
  log: SessionState<CombatV6Session>['log'];
  playing: boolean;
  pending: boolean;
  onCommand: (
    commands: import('@shared/contracts/combatV6').CombatV6CommandGroup,
  ) => Promise<void>;
  onResolve: () => Promise<void>;
  onAuto: () => Promise<void>;
  onClose: () => void;
  back: string;
  backLabel: string;
};
const outcomeLabels = {
  victory: '胜利',
  defeat: '落败',
  draw: '平局',
  aborted: '已离场',
};
const noTargets: string[] = [];
export function CombatV6Battle({
  allowAbandon = true,
  online,
  connected,
  onRetryCommand,
  clockOffset,
  title,
  session,
  shown,
  log,
  playing,
  pending,
  onCommand,
  onResolve,
  onAuto,
  onClose,
  back,
  backLabel,
}: Props) {
  const [autoSession, setAutoSession] = useState<string | null>(null);
  const autoEnabled = autoSession === session.sessionId && !session.outcome;
  const roundId = `${session.sessionId}:${session.round}:${autoEnabled}`;
  const [draft, setDraft] = useState<{
    id: string;
    command: CombatV6TrainingCommandV1;
  }>();
  const firstCommand = draft?.id === roundId ? draft.command : undefined;
  const commandOptions = useMemo(
    () =>
      session.controlledCommandOptions ??
      (session.commandOptions ? [session.commandOptions] : []),
    [session.controlledCommandOptions, session.commandOptions],
  );
  const [editing, setEditing] = useState<{ id: string; index: number }>();
  const activeIndex = editing?.id === roundId ? editing.index : 0;
  const activeOptions = commandOptions[activeIndex] ?? commandOptions[0];
  const [commandError, setCommandError] = useState<{
    id: string;
    text: string;
  }>();
  const commandSession =
    activeOptions === session.commandOptions
      ? session
      : { ...session, commandOptions: activeOptions };
  const selectionId = `${roundId}:${activeOptions?.unitId ?? 'ended'}`;
  const [selection, setSelection] = useState<{
    id: string;
    choice: Choice;
    targets: string[];
  }>();
  const choice = selection?.id === selectionId ? selection.choice : undefined;
  const targets = selection?.id === selectionId ? selection.targets : noTargets;
  const [inspected, setInspected] = useState<string>();
  const requestBusy = useRef(false);
  const blockedReason =
    connected === false
      ? '连接恢复中'
      : onRetryCommand
        ? '提交尚未确认，草稿已保留'
        : undefined;
  const disabled = pending || playing || !!blockedReason;
  const autoReady =
    autoEnabled &&
    !disabled &&
    !online?.spectator &&
    (!online || online.stage === 'collecting') &&
    commandOptions.some((option) => option.canSubmit);
  useEffect(() => {
    if (!autoReady) return;
    const timer = window.setTimeout(() => {
      if (requestBusy.current) return;
      requestBusy.current = true;
      void onAuto()
        .catch(() => {
          setAutoSession((current) =>
            current === session.sessionId ? null : current,
          );
        })
        .finally(() => {
          requestBusy.current = false;
        });
    }, AUTO_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [autoReady, session.sessionId, session.round, onAuto]);
  const labels = useMemo(
    () => unitLabels(shown.units, online?.spectator),
    [shown.units, online?.spectator],
  );
  const byId = useMemo(
    () => new Map(shown.units.map((u) => [u.id, u])),
    [shown.units],
  );
  const detailUnit = inspected ? byId.get(inspected) : undefined;
  const closeDetails = useCallback(() => setInspected(undefined), []);
  const cancel = useCallback(() => {
    setSelection(undefined);
  }, []);
  const submit = useCallback(
    async (command: CombatV6TrainingCommandV1) => {
      if (disabled || requestBusy.current) return;
      if (!activeOptions) return;
      if (commandOptions.length > 1 && activeIndex === 0) {
        setDraft({ id: roundId, command });
        setEditing({ id: roundId, index: 1 });
        setCommandError(undefined);
        cancel();
        return;
      }
      requestBusy.current = true;
      setCommandError(undefined);
      try {
        await onCommand(
          firstCommand && commandOptions.length > 1
            ? [
                { unitId: commandOptions[0].unitId, command: firstCommand },
                { unitId: activeOptions.unitId, command },
              ]
            : [{ unitId: activeOptions.unitId, command }],
        );
        setDraft(undefined);
        setEditing(undefined);
        cancel();
      } catch (cause) {
        setCommandError({
          id: roundId,
          text: cause instanceof Error ? cause.message : '提交失败，草稿已保留',
        });
      } finally {
        requestBusy.current = false;
      }
    },
    [
      disabled,
      onCommand,
      cancel,
      activeOptions,
      activeIndex,
      commandOptions,
      firstCommand,
      roundId,
    ],
  );
  const pick = useCallback(
    (id: string) => {
      if (!choice || disabled || !choice.ids.includes(id)) return;
      const next = targets.includes(id)
        ? targets.filter((t) => t !== id)
        : [...targets, id];
      setSelection({ id: selectionId, choice, targets: next });
      if (next.length === choice.count)
        void submit(
          choice.type === 'skill'
            ? { type: 'skill', skillId: choice.skillId!, targets: next }
            : { type: choice.type, target: next[0] },
        );
    },
    [choice, disabled, targets, submit, selectionId],
  );
  const setAction = (next: Choice) => {
    setSelection({ id: selectionId, choice: next, targets: [] });
  };
  const ended = !playing && session.outcome;
  return (
    <section
      className={`cv6-battle ${shown.units.filter((u) => !u.ownerId).length <= 2 ? 'is-small' : ''}`}
      aria-label={title}
    >
      <header className="cv6-header">
        <h1>{title}</h1>
        <CombatV6Status
          round={shown.round}
          playing={playing}
          online={online}
          connected={connected}
          clockOffset={clockOffset}
          outcome={
            ended
              ? online?.spectator
                ? (
                    {
                      victory: '青方获胜',
                      defeat: '赤方获胜',
                      draw: '平局',
                      aborted: '战斗已终止',
                    } as const
                  )[ended]
                : outcomeLabels[ended]
              : undefined
          }
        />
        {online?.spectator ? (
          <button disabled={pending} onClick={onClose}>
            退出观战
          </button>
        ) : (
          <Link to={back}>{backLabel}</Link>
        )}
      </header>
      <div className="cv6-field">
        <CombatV6Roster
          spectator={online?.spectator}
          units={shown.units}
          labels={labels}
          appearances={session.display?.unitAppearances}
          ownId={session.controlledUnitId ?? commandOptions[0]?.unitId}
          controlledId={playing ? undefined : activeOptions?.unitId}
          readyIds={
            !playing && online?.stage === 'collecting'
              ? online.submittedUnitIds
              : undefined
          }
          targetIds={disabled ? undefined : choice?.ids}
          feedback={
            playing ? frameFeedback(log.entries, shown.visibleSeq) : undefined
          }
          recalledOwnerIds={session.events.flatMap(({ seq, event }) =>
            seq <= shown.visibleSeq && event.type === 'petRecalled'
              ? [event.unitId]
              : [],
          )}
          selectedIds={targets}
          onInspect={setInspected}
          onPick={pick}
        />
        <CombatV6Log entries={log.entries} visibleSeq={shown.visibleSeq} />
      </div>
      {!online?.spectator ? (
        <CombatV6Commands
          allowAbandon={allowAbandon}
          online={online}
          clockOffset={clockOffset}
          key={selectionId}
          session={commandSession}
          pending={pending}
          blockedReason={blockedReason}
          onRetryCommand={connected === false ? undefined : onRetryCommand}
          playing={playing}
          unitName={labels.get(activeOptions?.unitId ?? '') ?? '等待指令'}
          choice={choice}
          targets={targets}
          setAction={setAction}
          onCancel={cancel}
          submit={submit}
          onResolve={onResolve}
          autoEnabled={autoEnabled}
          onAuto={() => {
            setAutoSession(autoEnabled ? null : session.sessionId);
            setDraft(undefined);
            setEditing(undefined);
            cancel();
          }}
          onClose={onClose}
          commandError={
            commandError?.id === roundId ? commandError.text : undefined
          }
          steps={
            !playing && commandOptions.length > 1 ? (
              <div className="cv6-draft-steps" aria-label="本回合指令草稿">
                {commandOptions.map((option, index) => (
                  <button
                    key={option.unitId}
                    disabled={disabled || (index === 1 && !firstCommand)}
                    aria-pressed={activeIndex === index}
                    onClick={() => {
                      setEditing({ id: roundId, index });
                      cancel();
                    }}
                  >
                    <GameIcon
                      value={
                        session.display?.unitAppearances?.[option.unitId]
                          ?.icon ??
                        (index ? '🐾' : 'icon:cultivator-male-avatar')
                      }
                    />
                    <span>
                      {index ? '灵兽' : '人物'}
                      {index === 0 && firstCommand ? (
                        <small>
                          {commandSummary(firstCommand, session, labels)}
                        </small>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            ) : undefined
          }
        />
      ) : (
        <p className="cv6-muted p-3 text-sm">
          {ended ? '本场观战已结束' : '观战中'}
        </p>
      )}
      {ended && online && !online.spectator ? (
        <Link
          className="cv6-replay-link"
          to={`/game/battle/${session.sessionId}`}
        >
          查看回放 →
        </Link>
      ) : null}
      {detailUnit ? (
        <CombatV6Details
          detailUnit={detailUnit}
          label={labels.get(detailUnit.id) ?? detailUnit.name}
          display={session.display}
          onClose={closeDetails}
        />
      ) : null}
    </section>
  );
}

function commandSummary(
  command: CombatV6TrainingCommandV1,
  session: CombatV6Session,
  labels: Map<string, string>,
) {
  const action =
    command.type === 'skill'
      ? (session.display?.skills[command.skillId] ?? '技能')
      : (
          {
            attack: '攻击',
            defend: '防御',
            protect: '保护',
            flee: '逃跑',
            summon: '召唤',
            recall: '召回',
          } as const
        )[command.type];
  const targetId =
    'target' in command
      ? command.target
      : command.type === 'skill'
        ? command.targets[0]
        : undefined;
  const target = targetId ? labels.get(targetId) : undefined;
  return `${action}${target ? ` · ${target}` : ''}`;
}
