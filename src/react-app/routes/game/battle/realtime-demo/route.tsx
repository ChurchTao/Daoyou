import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import './realtimeBattleDemo.css';
import {
  attachRealtimeBattlePhaser,
  type RealtimeBattlePhaserController,
} from './RealtimeBattlePhaserRuntime';
import {
  createInitialRealtimeBattleSnapshot,
  REALTIME_BATTLE_LOOP_DURATION_MS,
  type RealtimeBattleCommand,
  type RealtimeBattleEntity,
  type RealtimeBattleSnapshot,
} from './realtimeBattleSimulation';

const COMMANDS: Array<{
  id: RealtimeBattleCommand;
  name: string;
  intent: string;
}> = [
  { id: 'split-light', name: '分光剑诀', intent: '截断所选敌手的招势' },
  { id: 'moon-step', name: '踏月步', intent: '换至所选敌手阵后' },
  { id: 'hold-origin', name: '抱元守一', intent: '收束真气，护住自身' },
  { id: 'fox-hunt', name: '唤狐逐影', intent: '令灵宠协击所选敌手' },
];

function formatBattleTime(elapsedMs: number) {
  return `${Math.floor(elapsedMs / 1_000)
    .toString()
    .padStart(2, '0')}.${Math.floor((elapsedMs % 1_000) / 100)}`;
}

function describeFocusedState(entity: RealtimeBattleEntity) {
  if (!entity.alive) return '已离阵';
  const state = [`气血 ${Math.round((entity.hp / entity.maxHp) * 100)}%`];
  if (entity.shield > 0) state.push(`护界 ${Math.ceil(entity.shield)}`);
  state.push(
    ...entity.actionStates.map((actionState) => actionState.label),
    ...entity.effects.map(
      (effect) =>
        `${effect.label}${effect.layers > 1 ? ` ×${effect.layers}` : ''}`,
    ),
  );
  return state.join(' · ');
}

export default function RealtimeBattleDemoPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RealtimeBattlePhaserController | undefined>(
    undefined,
  );
  const navigate = useNavigate();
  const location = useLocation();
  const [snapshot, setSnapshot] = useState<RealtimeBattleSnapshot>(() =>
    createInitialRealtimeBattleSnapshot(),
  );
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let controller: RealtimeBattlePhaserController | undefined;

    const mount = async () => {
      await document.fonts.ready;
      if (cancelled) return;
      controller = attachRealtimeBattlePhaser({
        root,
        onState: setSnapshot,
        onFocus: () => undefined,
      });
      controllerRef.current = controller;
    };

    void mount();
    return () => {
      cancelled = true;
      controller?.destroy();
      if (controllerRef.current === controller) {
        controllerRef.current = undefined;
      }
    };
  }, []);

  const focusedEntity = useMemo(
    () =>
      snapshot.entities.find(
        (entity) => entity.id === snapshot.focusedEntityId,
      ),
    [snapshot.entities, snapshot.focusedEntityId],
  );
  const togglePause = () => {
    const nextPaused = !paused;
    setPaused(nextPaused);
    controllerRef.current?.setPaused(nextPaused);
  };

  const toggleSpeed = () => {
    const nextSpeed = speed === 1 ? 2 : 1;
    setSpeed(nextSpeed);
    controllerRef.current?.setSpeed(nextSpeed);
  };

  return (
    <div className="realtime-battle-demo">
      <header className="realtime-battle-demo__header">
        <div className="realtime-battle-demo__identity">
          <button
            type="button"
            className="realtime-battle-demo__quiet-button"
            onClick={() =>
              navigate(
                location.pathname.startsWith('/game/')
                  ? '/game/battle/history'
                  : '/',
              )
            }
          >
            [离阵]
          </button>
          <div className="min-w-0">
            <div className="realtime-battle-demo__title">
              青云试剑 · 联阵演武
            </div>
          </div>
        </div>

        <div className="realtime-battle-demo__round" aria-live="polite">
          <strong>
            第 {snapshot.cycle} 阵 · {snapshot.phase}
          </strong>
          <span>
            {formatBattleTime(snapshot.elapsedMs)} /{' '}
            {(REALTIME_BATTLE_LOOP_DURATION_MS / 1_000).toFixed(1)}息
          </span>
        </div>

        <div className="realtime-battle-demo__tools">
          <span className="realtime-battle-demo__live">实时推演</span>
          <button
            type="button"
            className="realtime-battle-demo__quiet-button"
            onClick={togglePause}
          >
            {paused ? '继续' : '暂停'}
          </button>
          <button
            type="button"
            className="realtime-battle-demo__quiet-button"
            onClick={toggleSpeed}
          >
            ×{speed}
          </button>
        </div>
      </header>

      <main className="realtime-battle-demo__stage">
        <div ref={rootRef} className="realtime-battle-demo__canvas" />
        {focusedEntity && (
          <aside className="realtime-battle-demo__focus">
            <div className="realtime-battle-demo__focus-name">
              已定目标 · {focusedEntity.name}
            </div>
            <div className="realtime-battle-demo__focus-state">
              {describeFocusedState(focusedEntity)}
            </div>
          </aside>
        )}
      </main>

      <footer className="realtime-battle-demo__commands" aria-label="战斗指令">
        <div className="realtime-battle-demo__command-grid">
          {COMMANDS.map((command) => (
            <button
              key={command.id}
              type="button"
              className="realtime-battle-demo__command"
              onClick={() => controllerRef.current?.command(command.id)}
            >
              <strong>{command.name}</strong>
              <span>{command.intent}</span>
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
