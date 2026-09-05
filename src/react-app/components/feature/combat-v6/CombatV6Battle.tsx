import type { CombatV6TrainingCommandV1 } from '@shared/contracts/combatV6';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { CombatV6Commands, type Choice } from './CombatV6Commands';
import { CombatV6Details } from './CombatV6Details';
import { CombatV6Log } from './CombatV6Log';
import { CombatV6Roster } from './CombatV6Roster';
import { unitLabels } from './presentation';
import type { CombatV6Session, SessionState } from './session';

type Props = {
  title: string;
  session: CombatV6Session;
  shown: SessionState<CombatV6Session>['shown'];
  log: SessionState<CombatV6Session>['log'];
  playing: boolean;
  pending: boolean;
  onCommand: (command: CombatV6TrainingCommandV1) => Promise<void>;
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
  const selectionId = `${session.sessionId}:${session.revision}:${session.commandOptions?.unitId ?? 'ended'}`;
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
      requestBusy.current = true;
      cancel();
      try {
        await onCommand(command);
      } finally {
        requestBusy.current = false;
      }
    },
    [disabled, onCommand, cancel],
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
            ? outcomeLabels[ended]
            : `第 ${shown.round} 回合 · ${playing ? '战斗中' : '下令中'}`}
        </span>
        <Link to={back}>{backLabel}</Link>
      </header>
      <div className="cv6-field">
        <CombatV6Roster
          units={shown.units}
          labels={labels}
          controlledId={playing ? undefined : session.commandOptions?.unitId}
          targetIds={disabled ? undefined : choice?.ids}
          selectedIds={targets}
          onInspect={setInspected}
          onPick={pick}
        />
        <CombatV6Log entries={log.entries} visibleSeq={shown.visibleSeq} />
      </div>
      <CombatV6Commands
        session={session}
        pending={pending}
        playing={playing}
        unitName={
          labels.get(session.commandOptions?.unitId ?? '') ?? '等待指令'
        }
        choice={choice}
        targets={targets}
        setAction={setAction}
        onCancel={cancel}
        submit={submit}
        onResolve={onResolve}
        onClose={onClose}
      />
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
