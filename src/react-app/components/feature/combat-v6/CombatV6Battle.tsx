import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import type { ArenaSessionView } from '@shared/contracts/combatV6Arena';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CombatV6Commands, type Choice } from './CombatV6Commands';
import { CombatV6Details } from './CombatV6Details';
import { CombatV6Log } from './CombatV6Log';
import { CombatV6Roster } from './CombatV6Roster';
import { unitLabels } from './presentation';
import type { CombatV6Session, SessionState } from './session';

type Props = {
  allowAbandon?: boolean;
  online?: ArenaSessionView;
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
  title,
  session,
  shown,
  log,
  playing,
  pending,
  onCommand,
  onResolve,
  onClose,
  back,
  backLabel,
}: Props) {
  const roundId = `${session.sessionId}:${session.round}`;
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
  const activeOptions =
    commandOptions[firstCommand && commandOptions.length > 1 ? 1 : 0];
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
  const disabled = pending || playing;
  const labels = useMemo(() => unitLabels(shown.units), [shown.units]);
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
      if (commandOptions.length > 1 && !firstCommand) {
        setDraft({ id: roundId, command });
        cancel();
        return;
      }
      requestBusy.current = true;
      cancel();
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
      } finally {
        requestBusy.current = false;
      }
    },
    [
      disabled,
      onCommand,
      cancel,
      activeOptions,
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
    <section className="cv6-battle" aria-label={title}>
      <header className="cv6-header">
        <h1>{title}</h1>
        <span>
          {ended
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
            : `第 ${shown.round} 回合 · ${playing ? '战斗中' : '下令中'}`}
        </span>
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
          controlledId={playing ? undefined : activeOptions?.unitId}
          targetIds={disabled ? undefined : choice?.ids}
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
          key={selectionId}
          session={commandSession}
          pending={pending}
          playing={playing}
          unitName={labels.get(activeOptions?.unitId ?? '') ?? '等待指令'}
          choice={choice}
          targets={targets}
          setAction={setAction}
          onCancel={cancel}
          submit={submit}
          onResolve={onResolve}
          onClose={onClose}
          onPrevious={
            firstCommand && commandOptions.length > 1
              ? () => {
                  setDraft(undefined);
                  cancel();
                }
              : undefined
          }
        />
      ) : (
        <p className="cv6-muted p-3 text-sm">
          {ended ? '本场观战已结束' : '观战中'}
        </p>
      )}
      {ended && !online?.spectator ? (
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
