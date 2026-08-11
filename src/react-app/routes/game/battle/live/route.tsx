import { BattleAbilityDrawer } from '@app/components/feature/battle/realtime/BattleAbilityDrawer';
import {
  abilityTargetLabel,
  unavailableAbilityLabel,
} from '@app/components/feature/battle/realtime/battleAbilityLabels';
import { BattlePresentationDirector } from '@app/components/feature/battle/realtime/BattlePresentationDirector';
import {
  BattleCommandDock,
  BattleRoundHud,
  BattleStatusNotice,
  BattleTargetPrompt,
  BattleUnitInspector,
  BattleUtilityHud,
  type RealtimeBattleRoundPhase,
} from '@app/components/feature/battle/realtime/RealtimeBattleHud';
import {
  attachRealtimeBattlePhaser,
  type RealtimeBattlePhaserController,
} from '@app/components/feature/battle/realtime/RealtimeBattlePhaserRuntime';
import { CombatActionLogV3 } from '@app/components/feature/battle/v3/CombatActionLog';
import {
  BATTLE_QUICKBAR_MAX_SLOTS,
  loadBattleQuickbar,
  toggleBattleQuickbarAbility,
} from '@app/lib/battle/battleQuickbarStorage';
import { useBattleMatchClient } from '@app/lib/battle/useBattleMatchClient';
import type {
  BattleMatchPlayerViewV1,
  ClientBattleIntentV1,
} from '@shared/engine/battle-v5/match/types';
import type { PlanningAbilityViewV1 } from '@shared/engine/battle-v5/round/types';
import type { CombatSequenceV3 } from '@shared/engine/battle-v5/v3';
import {
  createBattlePresentationSnapshot,
  createBattlePresentationSnapshotFromPublic,
} from '@shared/online-battle/BattlePresentation';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useParams } from 'react-router';

function remainingSeconds(deadlineAt: number | undefined, now: number) {
  if (!deadlineAt) return undefined;
  return Math.max(0, Math.ceil((deadlineAt - now) / 1000));
}

interface PlanningCommandChoice {
  abilityId: string;
  name: string;
  targetTeam: 'enemy' | 'ally' | 'self' | 'any';
  targetScope: 'single' | 'aoe' | 'random';
  legalTargetIds: string[];
  intentKind: 'ability' | 'basic_attack';
}

function unitName(view: BattleMatchPlayerViewV1, unitId: string) {
  return (
    view.publicSnapshot.units.find((unit) => unit.unitId === unitId)?.name ??
    unitId
  );
}

type BattleCommandMode =
  | 'select_unit'
  | 'select_ability'
  | 'select_target'
  | 'locked'
  | 'committed'
  | 'presenting';

interface BattleCommandDraft {
  readonly unitId: string;
  readonly intent: ClientBattleIntentV1;
  readonly choice: PlanningCommandChoice;
  readonly stage: 'select_target';
}

export default function LiveBattleMatchPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const { view, viewReceivedAt, connectionStatus, error, actions } =
    useBattleMatchClient(matchId ?? null);
  const [now, setNow] = useState(() => Date.now());
  const [activeUnitId, setActiveUnitId] = useState<string | null>(null);
  const [inspectedUnitId, setInspectedUnitId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandDrafts, setCommandDrafts] = useState<
    Record<string, BattleCommandDraft>
  >({});
  const [plannedIntents, setPlannedIntents] = useState<
    Record<string, ClientBattleIntentV1>
  >({});
  const [commitPending, setCommitPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [quickbarOverrides, setQuickbarOverrides] = useState<
    Record<string, string[]>
  >({});
  const [revealedResultMatchId, setRevealedResultMatchId] = useState<
    string | null
  >(null);
  const [phaserReady, setPhaserReady] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugSequences, setDebugSequences] = useState<CombatSequenceV3[]>([]);
  const [debugActiveSequenceId, setDebugActiveSequenceId] = useState<
    string | null
  >(null);
  const [debugResolvedFactCount, setDebugResolvedFactCount] = useState(0);
  const phaserRootRef = useRef<HTMLDivElement>(null);
  const phaserControllerRef = useRef<RealtimeBattlePhaserController | null>(
    null,
  );
  const presentationDirectorRef = useRef<BattlePresentationDirector | null>(
    null,
  );
  const checkpointRevisionRef = useRef<number | null>(null);
  const autoCommitAttemptRef = useRef<string | null>(null);
  const commitRequestRef = useRef<{
    checkpointRevision: number;
    requestId: string;
  } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const ownUnits = useMemo(
    () => view?.planningView?.units ?? [],
    [view?.planningView?.units],
  );
  const nextUnlockedUnitId =
    ownUnits.find((unit) => unit.alive && !plannedIntents[unit.unitId])
      ?.unitId ?? null;
  const fallbackUnitId =
    nextUnlockedUnitId ??
    ownUnits.find((unit) => unit.alive)?.unitId ??
    ownUnits[0]?.unitId ??
    null;
  const resolvedActiveUnitId =
    activeUnitId &&
    ownUnits.some(
      (unit) => unit.unitId === activeUnitId && !plannedIntents[unit.unitId],
    )
      ? activeUnitId
      : fallbackUnitId;
  const activeUnit =
    ownUnits.find((unit) => unit.unitId === resolvedActiveUnitId) ?? null;
  const activeAbilities = activeUnit?.abilities ?? [];
  const ownSubmissions = view?.ownSubmissions ?? {};
  const allPlayersReady = view?.orchestration.allPlayersReady ?? false;
  const serverNow =
    view?.serverNow !== undefined && viewReceivedAt !== null
      ? view.serverNow + (now - viewReceivedAt)
      : now;
  const presentationActive = Boolean(
    view?.presentation && serverNow < view.presentation.endsAt,
  );
  const isPlanning = Boolean(
    view &&
    connectionStatus === 'connected' &&
    allPlayersReady &&
    view.status === 'planning' &&
    !presentationActive,
  );
  const isCommitted = view?.ownCommitted ?? false;
  const isResolving = view?.status === 'resolving';
  const inspectedUnit = inspectedUnitId
    ? view?.publicSnapshot.units.find((unit) => unit.unitId === inspectedUnitId)
    : undefined;
  const quickbarScope = `${view?.playerId ?? ''}:${resolvedActiveUnitId ?? ''}`;
  const quickbar =
    quickbarOverrides[quickbarScope] ??
    (view && resolvedActiveUnitId
      ? loadBattleQuickbar(view.playerId, resolvedActiveUnitId)
      : []);
  const activeDraft = resolvedActiveUnitId
    ? commandDrafts[resolvedActiveUnitId]
    : undefined;
  const targetAbility =
    activeDraft?.stage === 'select_target' ? activeDraft.choice : null;
  const displayIntents = isCommitted ? ownSubmissions : plannedIntents;
  const allLivingUnitsLocked =
    ownUnits.some((unit) => unit.alive) &&
    ownUnits.every(
      (unit) => !unit.alive || Boolean(plannedIntents[unit.unitId]),
    );
  const commandMode: BattleCommandMode = presentationActive
    ? 'presenting'
    : isCommitted || isResolving
      ? 'committed'
      : activeDraft?.stage === 'select_target'
        ? 'select_target'
        : allLivingUnitsLocked
          ? 'locked'
          : resolvedActiveUnitId
            ? 'select_ability'
            : 'select_unit';
  const roundRemainingSeconds = remainingSeconds(view?.deadlineAt, serverNow);
  const roundPhase: RealtimeBattleRoundPhase = presentationActive
    ? 'presenting'
    : view?.status === 'finished' || view?.status === 'cancelled'
      ? 'finished'
      : isResolving
        ? 'resolving'
        : isCommitted
          ? 'committed'
          : !view
            ? 'connecting'
            : !allPlayersReady
              ? 'waiting'
              : 'planning';
  const commandDockExpanded = Boolean(
    isPlanning && !isCommitted && !allLivingUnitsLocked,
  );
  const presentationSnapshot = useMemo(
    () =>
      view
        ? createBattlePresentationSnapshot(view, inspectedUnitId ?? undefined)
        : null,
    [view, inspectedUnitId],
  );
  const initialPresentationSnapshotRef = useRef<{
    matchId: string | undefined;
    snapshot: NonNullable<typeof presentationSnapshot>;
  } | null>(null);
  const hasPresentationSnapshot = presentationSnapshot !== null;
  const quickbarAbilities = quickbar
    .map((abilityId) =>
      activeAbilities.find((ability) => ability.abilityId === abilityId),
    )
    .filter((ability): ability is PlanningAbilityViewV1 => Boolean(ability));
  const debugActiveIndex = debugSequences.findIndex(
    (sequence) => sequence.id === debugActiveSequenceId,
  );
  const debugCurrentIndex =
    debugActiveIndex >= 0
      ? debugActiveIndex
      : Math.max(0, debugSequences.length - 1);

  const submitLockedIntents = useCallback(
    (intents: Record<string, ClientBattleIntentV1>) => {
      if (!actions || !isPlanning || isCommitted || commitPending || !view)
        return false;
      setActionError(null);
      setCommitPending(true);
      try {
        const requestId =
          commitRequestRef.current?.checkpointRevision ===
          view.checkpointRevision
            ? commitRequestRef.current.requestId
            : crypto.randomUUID();
        commitRequestRef.current = {
          checkpointRevision: view.checkpointRevision,
          requestId,
        };
        actions.commitIntents(
          intents,
          view.round,
          view.checkpointRevision,
          requestId,
        );
        return true;
      } catch {
        setCommitPending(false);
        setActionError('本方指令未能确认，请重试。');
        return false;
      }
    },
    [actions, commitPending, isCommitted, isPlanning, view],
  );

  useEffect(() => {
    if (
      !allLivingUnitsLocked ||
      !view ||
      !isPlanning ||
      isCommitted ||
      commitPending
    )
      return;
    const attemptKey = `${view.checkpointRevision}:${Object.keys(plannedIntents).sort().join(',')}`;
    if (autoCommitAttemptRef.current === attemptKey) return;
    autoCommitAttemptRef.current = attemptKey;
    submitLockedIntents(plannedIntents);
  }, [
    allLivingUnitsLocked,
    commitPending,
    isCommitted,
    isPlanning,
    plannedIntents,
    submitLockedIntents,
    view,
  ]);

  useEffect(() => {
    if (!commitPending) return;
    if (
      isCommitted ||
      connectionStatus !== 'connected' ||
      view?.status !== 'planning'
    ) {
      const clearTimer = window.setTimeout(() => setCommitPending(false), 0);
      return () => window.clearTimeout(clearTimer);
    }
    const timer = window.setTimeout(() => {
      setCommitPending(false);
      setActionError('本方指令未获服务端确认，请根据最新战况重试。');
    }, 5_000);
    return () => window.clearTimeout(timer);
  }, [commitPending, connectionStatus, isCommitted, view?.status]);

  useEffect(() => {
    const receipt = view?.commandReceipt;
    const request = commitRequestRef.current;
    if (!receipt || !request || receipt.requestId !== request.requestId) return;
    const timer = window.setTimeout(() => {
      setCommitPending(false);
      if (receipt.status === 'rejected') {
        const labels = {
          deadline_reached: '本回合已经截止，服务端正在执行默认操作。',
          already_committed: '本方指令已经确认，不能重复修改。',
          stale_match: '战局状态已经变化，请等待最新状态同步。',
          stale_checkpoint: '当前指令属于旧回合，请等待最新战况。',
          invalid_intents: '本方指令不符合当前战局规则。',
          match_not_planning: '战局已经进入结算阶段。',
        } as const;
        setActionError(
          receipt.reason ? labels[receipt.reason] : '服务端拒绝了本方指令。',
        );
      } else {
        setActionError(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [view?.commandReceipt]);

  const lockUnitIntent = useCallback(
    (unitId: string, intent: ClientBattleIntentV1) => {
      setPlannedIntents((current) =>
        current[unitId] ? current : { ...current, [unitId]: intent },
      );
      setCommandDrafts((current) => {
        if (!current[unitId]) return current;
        const next = { ...current };
        delete next[unitId];
        return next;
      });
      setActionError(null);
    },
    [],
  );

  const chooseAbility = (ability: PlanningAbilityViewV1) => {
    if (
      !ability.ready ||
      !isPlanning ||
      isCommitted ||
      !activeUnit ||
      plannedIntents[activeUnit.unitId]
    )
      return;
    const intent: ClientBattleIntentV1 = {
      kind: 'ability',
      abilityId: ability.abilityId,
      ...(ability.targetTeam === 'self'
        ? { targetUnitId: activeUnit.unitId }
        : {}),
    };
    const needsTarget =
      ability.targetTeam !== 'self' &&
      ability.targetScope === 'single' &&
      ability.legalTargetIds.length > 0;
    if (needsTarget) {
      setCommandDrafts((current) => ({
        ...current,
        [activeUnit.unitId]: {
          unitId: activeUnit.unitId,
          intent,
          choice: { ...ability, intentKind: 'ability' },
          stage: 'select_target',
        },
      }));
    } else {
      lockUnitIntent(activeUnit.unitId, intent);
    }
    setActionError(null);
    setDrawerOpen(false);
  };

  const chooseBasicAttack = () => {
    if (
      !activeUnit ||
      !isPlanning ||
      isCommitted ||
      !activeUnit.basicAttack ||
      plannedIntents[activeUnit.unitId]
    )
      return;
    const forced = activeUnit.forcedAction;
    const choice: PlanningCommandChoice = forced
      ? {
          abilityId: forced.abilityId,
          name: forced.abilityName,
          targetTeam: 'enemy',
          targetScope: 'single',
          legalTargetIds: forced.legalTargetIds,
          intentKind: 'basic_attack',
        }
      : {
          abilityId: 'basic_attack',
          name: activeUnit.basicAttack.name,
          targetTeam: 'enemy',
          targetScope: 'single',
          legalTargetIds: activeUnit.basicAttack.legalTargetIds,
          intentKind: 'basic_attack',
        };
    setCommandDrafts((current) => ({
      ...current,
      [activeUnit.unitId]: {
        unitId: activeUnit.unitId,
        intent: { kind: 'basic_attack' },
        choice,
        stage: 'select_target',
      },
    }));
    setActionError(null);
  };

  const clearActiveDraft = () => {
    if (!resolvedActiveUnitId) return;
    setCommandDrafts((current) => {
      const next = { ...current };
      delete next[resolvedActiveUnitId];
      return next;
    });
    setActionError(null);
  };

  const submittedIntentLabel = (unitId: string) => {
    const intent = displayIntents[unitId];
    if (!intent) return '待选';
    const abilityId = intent.kind === 'ability' ? intent.abilityId : undefined;
    const ability = ownUnits
      .find((unit) => unit.unitId === unitId)
      ?.abilities.find((entry) => entry.abilityId === abilityId);
    const basicName =
      ownUnits.find((unit) => unit.unitId === unitId)?.forcedAction
        ?.abilityName ??
      ownUnits.find((unit) => unit.unitId === unitId)?.basicAttack?.name ??
      '普通攻击';
    const target = intent.targetUnitId
      ? unitName(view!, intent.targetUnitId)
      : '自动目标';
    return `${isCommitted ? '已确认' : '已锁定'}：${intent.kind === 'basic_attack' ? basicName : (ability?.name ?? abilityId)} → ${target}`;
  };

  useEffect(() => {
    presentationDirectorRef.current?.cancel();
    checkpointRevisionRef.current = null;
    autoCommitAttemptRef.current = null;
    commitRequestRef.current = null;
    const clearTimer = window.setTimeout(() => {
      setCommitPending(false);
      setActionError(null);
      setCommandDrafts({});
      setPlannedIntents({});
      setDrawerOpen(false);
      setDebugSequences([]);
      setDebugActiveSequenceId(null);
      setDebugResolvedFactCount(0);
    }, 0);
    return () => window.clearTimeout(clearTimer);
  }, [matchId]);

  useEffect(() => {
    if (!view) return;
    if (checkpointRevisionRef.current === null) {
      checkpointRevisionRef.current = view.checkpointRevision;
      return;
    }
    if (checkpointRevisionRef.current === view.checkpointRevision) return;
    checkpointRevisionRef.current = view.checkpointRevision;
    autoCommitAttemptRef.current = null;
    commitRequestRef.current = null;
    const timer = window.setTimeout(() => {
      setPlannedIntents({});
      setCommandDrafts({});
      setCommitPending(false);
      setDrawerOpen(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [view?.checkpointRevision, view]);

  useEffect(() => {
    const resolution = view?.latestResolution;
    if (!resolution) return;
    const timer = window.setTimeout(() => {
      setDebugSequences((current) => {
        const existing = new Set(current.map((sequence) => sequence.id));
        const additions = resolution.sequences.filter(
          (sequence) => !existing.has(sequence.id),
        );
        return additions.length > 0 ? [...current, ...additions] : current;
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [view?.latestResolution]);

  const entityClickRef = useRef<(entityId: string) => void>(() => undefined);
  useEffect(() => {
    entityClickRef.current = (entityId) => {
      const target = targetAbility?.legalTargetIds.includes(entityId);
      if (target && resolvedActiveUnitId && targetAbility) {
        lockUnitIntent(
          resolvedActiveUnitId,
          targetAbility.intentKind === 'basic_attack'
            ? { kind: 'basic_attack', targetUnitId: entityId }
            : {
                kind: 'ability',
                abilityId: targetAbility.abilityId,
                targetUnitId: entityId,
              },
        );
        return;
      }
      if (targetAbility) {
        setActionError('该单位不是此术法的合法目标，可取消后重新选招。');
        return;
      }
      setInspectedUnitId(entityId);
      const currentView = view;
      if (
        currentView &&
        !plannedIntents[entityId] &&
        currentView.teamId ===
          currentView.publicSnapshot.units.find(
            (unit) => unit.unitId === entityId,
          )?.teamId
      ) {
        setActiveUnitId(entityId);
      }
    };
  }, [
    lockUnitIntent,
    plannedIntents,
    targetAbility,
    resolvedActiveUnitId,
    view,
  ]);

  useEffect(() => {
    if (
      presentationSnapshot &&
      initialPresentationSnapshotRef.current?.matchId !== matchId
    ) {
      initialPresentationSnapshotRef.current = {
        matchId,
        snapshot: presentationSnapshot,
      };
    }
  }, [matchId, presentationSnapshot]);

  useEffect(() => {
    const root = phaserRootRef.current;
    const initialSnapshot = initialPresentationSnapshotRef.current?.snapshot;
    if (!root || !initialSnapshot) return;
    let cancelled = false;
    let controller: RealtimeBattlePhaserController | undefined;
    const mount = async () => {
      await document.fonts.ready;
      if (cancelled) return;
      controller = attachRealtimeBattlePhaser({
        root,
        initialSnapshot,
        onState: () => undefined,
        onFocus: (entityId) => entityClickRef.current(entityId),
      });
      phaserControllerRef.current = controller;
      presentationDirectorRef.current = new BattlePresentationDirector(
        controller,
      );
      setPhaserReady(true);
    };
    void mount();
    return () => {
      cancelled = true;
      setPhaserReady(false);
      presentationDirectorRef.current?.destroy();
      presentationDirectorRef.current = null;
      controller?.destroy();
      if (phaserControllerRef.current === controller)
        phaserControllerRef.current = null;
    };
  }, [matchId, hasPresentationSnapshot]);

  useEffect(() => {
    if (presentationActive) return;
    phaserControllerRef.current?.syncSnapshot(
      presentationSnapshot ?? {
        version: 'battle_presentation_snapshot_v1',
        elapsedMs: 0,
        cycle: 0,
        phase: '连接中',
        focusedEntityId: '',
        entities: [],
      },
    );
  }, [presentationActive, presentationSnapshot]);

  useEffect(() => {
    phaserControllerRef.current?.setCommandSelection({
      actorUnitId:
        isPlanning && !allLivingUnitsLocked
          ? (resolvedActiveUnitId ?? undefined)
          : undefined,
      legalTargetIds: targetAbility?.legalTargetIds ?? [],
      lockedUnitIds: Object.keys(plannedIntents),
      submitting: commitPending,
    });
  }, [
    allLivingUnitsLocked,
    commitPending,
    isPlanning,
    phaserReady,
    plannedIntents,
    resolvedActiveUnitId,
    targetAbility,
  ]);

  useEffect(() => {
    if (!phaserReady || !view?.presentation || !presentationSnapshot) return;
    const startSnapshot = createBattlePresentationSnapshotFromPublic(
      view.presentation.startingPublicSnapshot,
      view.teamId,
      {
        cycle: view.presentation.plan.round,
        phase: '回合演算',
        focusedEntityId: inspectedUnitId ?? undefined,
      },
    );
    presentationDirectorRef.current?.play({
      window: view.presentation,
      startingSnapshot: startSnapshot,
      finalSnapshot: presentationSnapshot,
      serverNow:
        view.serverNow +
        (viewReceivedAt === null ? 0 : Date.now() - viewReceivedAt),
      onBeatStart: (beat) => {
        setDebugActiveSequenceId(
          beat.sequenceIds[beat.sequenceIds.length - 1] ?? null,
        );
      },
      onFactResolved: () => setDebugResolvedFactCount((current) => current + 1),
    });
    return () => presentationDirectorRef.current?.cancel();
  }, [
    inspectedUnitId,
    phaserReady,
    presentationSnapshot,
    view?.presentation,
    view?.serverNow,
    view?.teamId,
    viewReceivedAt,
  ]);

  useEffect(() => {
    if (view?.status !== 'finished' || !matchId) return;
    const currentServerNow =
      view.serverNow +
      (viewReceivedAt === null ? 0 : Date.now() - viewReceivedAt);
    const presentationMs = view.presentation
      ? Math.max(0, view.presentation.endsAt - currentServerNow) + 250
      : 0;
    const timer = window.setTimeout(
      () => setRevealedResultMatchId(matchId),
      presentationMs,
    );
    return () => window.clearTimeout(timer);
  }, [
    matchId,
    view?.presentation,
    view?.serverNow,
    view?.status,
    viewReceivedAt,
  ]);

  const commandDockStyle = {
    '--battle-command-safe': commandDockExpanded
      ? 'clamp(10.75rem, 25dvh, 13.5rem)'
      : 'clamp(4.8rem, 10dvh, 5.5rem)',
  } as CSSProperties;
  const statusNotice = view?.resolutionFailure
    ? {
        tone: 'danger' as const,
        message: '本回合结算失败，战局已安全冻结；已锁定指令不会丢失。',
      }
    : connectionStatus === 'disconnected'
      ? {
          tone: 'warning' as const,
          message: '连接已中断，正在恢复战局；恢复前不能提交新指令。',
        }
      : error
        ? { tone: 'danger' as const, message: error }
        : actionError
          ? { tone: 'danger' as const, message: actionError }
          : null;

  return (
    <main
      className="battle-live-shell relative h-[100dvh] min-h-0 overflow-hidden text-[#2c1810]"
      style={commandDockStyle}
    >
      <section
        className="absolute inset-0 overflow-hidden"
        aria-label="实时多人战局"
      >
        <div
          ref={phaserRootRef}
          className="absolute inset-0 overflow-hidden"
          aria-label="多人实时战斗场景"
        />
        <div className="battle-arena-vignette pointer-events-none absolute inset-0 z-10" />
        {!view && (
          <p className="absolute inset-0 z-20 grid place-items-center text-sm text-[#2c1810]/50">
            正在建立战斗服务连接…
          </p>
        )}
      </section>

      <BattleRoundHud
        round={
          presentationActive ? view?.presentation?.plan.round : view?.round
        }
        phase={roundPhase}
        remainingSeconds={roundRemainingSeconds}
      />
      <BattleUtilityHud
        connectionStatus={connectionStatus}
        debugOpen={debugOpen}
        onToggleDebug={() => setDebugOpen((current) => !current)}
      />

      {statusNotice && (
        <BattleStatusNotice tone={statusNotice.tone}>
          {statusNotice.message}
        </BattleStatusNotice>
      )}

      {inspectedUnit && view && (
        <BattleUnitInspector
          unit={inspectedUnit}
          isAlly={inspectedUnit.teamId === view.teamId}
          onClose={() => setInspectedUnitId(null)}
        />
      )}

      {debugOpen && (
        <aside
          className="battle-debug-panel fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col p-4 pt-[calc(env(safe-area-inset-top)+1rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-2xl backdrop-blur sm:w-[26rem]"
          aria-label="Debug 战斗日志"
        >
          <div className="mb-2 flex items-start justify-between gap-3 border-b border-[#2c1810]/15 pb-3 text-[0.65rem] text-[#2c1810]/55">
            <div>
              <strong className="block text-xs tracking-[0.12em] text-[#2c1810]">
                引擎事实 / 动画对照
              </strong>
              <span className="mt-1 block">对局 {matchId ?? '—'}</span>
              <span className="mt-1 block">
                指令集{' '}
                {view?.presentation?.commandSetId ??
                  view?.latestResolution?.commandSetId ??
                  '—'}
              </span>
              <span className="block">
                checkpoint {view?.checkpointRevision ?? '—'} · 已播放事实{' '}
                {debugResolvedFactCount}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setDebugOpen(false)}
              className="border-b border-dashed border-[#2c1810]/35"
            >
              关闭
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <CombatActionLogV3
              sequences={debugSequences}
              currentIndex={debugCurrentIndex}
            />
          </div>
        </aside>
      )}

      {targetAbility && (
        <BattleTargetPrompt
          abilityName={targetAbility.name}
          targetLabel={abilityTargetLabel(targetAbility)}
          onCancel={clearActiveDraft}
        />
      )}

      <BattleCommandDock
        expanded={commandDockExpanded}
        summary={
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <strong className="block truncate text-sm text-[#3f6b56]">
                {isCommitted
                  ? '本方行动已锁定'
                  : commitPending
                    ? '正在封存本方行动'
                    : allLivingUnitsLocked
                      ? '本方单位均已选定'
                      : activeUnit && view
                        ? `轮到 ${unitName(view, activeUnit.unitId)} 选择行动`
                        : '等待战局指令'}
              </strong>
              <span className="mt-0.5 block truncate text-xs text-[#2c1810]/55">
                {presentationActive
                  ? '正在按出手顺序播放本回合'
                  : isResolving
                    ? '双方指令已封存，正在统一演算'
                    : isCommitted
                      ? '等待其他玩家完成本回合'
                      : `${Object.keys(plannedIntents).length}/${ownUnits.filter((unit) => unit.alive).length} 个单位已定`}
              </span>
            </div>
            {allLivingUnitsLocked &&
            actionError &&
            !commitPending &&
            !isCommitted ? (
              <button
                type="button"
                className="shrink-0 rounded-full border border-[#8f2433]/35 px-3 py-1.5 text-xs text-[#8f2433]"
                onClick={() => submitLockedIntents(plannedIntents)}
              >
                重新提交
              </button>
            ) : null}
          </div>
        }
        actions={
          <>
            <button
              type="button"
              disabled={
                !isPlanning ||
                isCommitted ||
                !activeUnit ||
                Boolean(activeUnit && plannedIntents[activeUnit.unitId]) ||
                (activeUnit.forcedAction
                  ? activeUnit.forcedAction.legalTargetIds.length === 0
                  : !activeUnit.basicAttack?.ready)
              }
              onClick={chooseBasicAttack}
              className={`min-h-14 min-w-28 rounded-lg border bg-white/25 px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${activeUnit?.forcedAction ? 'border-[#8f2433]/55 text-[#8f2433]' : 'border-[#2c1810]/25 hover:border-[#2c1810]/45'}`}
            >
              <strong className="block truncate text-sm">
                {activeUnit?.forcedAction
                  ? `${activeUnit.forcedAction.abilityName}（强制）`
                  : (activeUnit?.basicAttack?.name ?? '普通攻击')}
              </strong>
              <span className="mt-1 block text-xs text-[#2c1810]/55">
                {activeUnit?.forcedAction ? '蓄势已成 · 选择目标' : '敌方单体'}
              </span>
            </button>
            {quickbarAbilities.map((ability) => (
              <button
                key={ability.abilityId}
                type="button"
                disabled={
                  !isPlanning ||
                  !ability.ready ||
                  isCommitted ||
                  Boolean(activeUnit?.forcedAction) ||
                  Boolean(activeUnit && plannedIntents[activeUnit.unitId])
                }
                onClick={() => chooseAbility(ability)}
                className="min-h-14 min-w-28 rounded-lg border border-[#3f6b56]/35 bg-white/25 px-3 py-2 text-left transition-colors hover:border-[#3f6b56]/60 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <strong className="block truncate text-sm text-[#3f6b56]">
                  {ability.name}
                </strong>
                <span className="mt-1 block text-xs text-[#2c1810]/55">
                  {ability.ready
                    ? abilityTargetLabel(ability)
                    : unavailableAbilityLabel(ability)}
                </span>
              </button>
            ))}
            <button
              type="button"
              disabled={
                !isPlanning ||
                isCommitted ||
                Boolean(activeUnit?.forcedAction) ||
                Boolean(activeUnit && plannedIntents[activeUnit.unitId])
              }
              onClick={() => setDrawerOpen(true)}
              className="min-h-14 min-w-28 rounded-lg border border-dashed border-[#2c1810]/30 bg-white/15 px-3 py-2 text-left text-sm text-[#2c1810]/65 transition-colors hover:border-[#2c1810]/50 disabled:opacity-40"
            >
              全部术法
              <br />
              <span className="text-xs">
                {activeAbilities.length} 项 · {BATTLE_QUICKBAR_MAX_SLOTS}{' '}
                槽快捷栏
              </span>
            </button>
          </>
        }
        units={
          <div className="flex min-w-max gap-1.5" aria-label="受控单位">
            {ownUnits.map((unit) => (
              <button
                key={unit.unitId}
                type="button"
                disabled={
                  Boolean(plannedIntents[unit.unitId]) ||
                  isCommitted ||
                  Boolean(targetAbility && unit.unitId !== resolvedActiveUnitId)
                }
                onClick={() => setActiveUnitId(unit.unitId)}
                className={`min-h-9 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors disabled:cursor-default ${plannedIntents[unit.unitId] ? 'border-[#735080]/30 bg-[#735080]/8 text-[#735080]' : unit.unitId === resolvedActiveUnitId ? 'border-[#8f2433]/45 bg-[#8f2433]/7 text-[#8f2433]' : 'border-transparent text-[#2c1810]/55 hover:border-[#2c1810]/20'}`}
              >
                {unitName(view!, unit.unitId)} ·{' '}
                {commandDrafts[unit.unitId]
                  ? '选择目标'
                  : submittedIntentLabel(unit.unitId)}
              </button>
            ))}
          </div>
        }
        guidance={
          <>
            {commandMode === 'select_ability' &&
              (activeUnit?.forcedAction
                ? `蓄势已成：本回合必须施放《${activeUnit.forcedAction.abilityName}》，请选择目标。`
                : `为 ${activeUnit ? unitName(view!, activeUnit.unitId) : '当前单位'} 选择招式；目标点下后立即锁定。`)}
            {commandMode === 'locked' &&
              (commitPending
                ? '全部单位已选定，正在一次性提交本方操作。'
                : '全部单位已选定，等待服务端确认。')}
            {commandMode === 'committed' &&
              (isResolving
                ? '双方指令已封存，服务端正在统一结算。'
                : '本方出招已确认，等待其他玩家；确认后不可修改。')}
            {commandMode === 'presenting' &&
              '本回合已统一结算，正在按出手顺序播放。'}
          </>
        }
      />

      <BattleAbilityDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        round={view?.round}
        unitName={
          view && activeUnit ? unitName(view, activeUnit.unitId) : '当前单位'
        }
        abilities={activeAbilities}
        quickbarAbilityIds={quickbar}
        enabled={
          isPlanning &&
          !isCommitted &&
          Boolean(activeUnit && !plannedIntents[activeUnit.unitId])
        }
        onChoose={chooseAbility}
        onToggleQuickbar={(abilityId) => {
          if (!view || !resolvedActiveUnitId) return;
          const next = toggleBattleQuickbarAbility(
            view.playerId,
            resolvedActiveUnitId,
            abilityId,
          );
          setQuickbarOverrides((current) => ({
            ...current,
            [quickbarScope]: next,
          }));
        }}
      />

      {!view && !error && <p className="sr-only">正在建立战斗服务连接</p>}

      {view?.status === 'finished' && revealedResultMatchId === matchId && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#2c1810]/35 px-4 backdrop-blur-[2px]">
          <section className="w-full max-w-sm border border-[#2c1810]/25 bg-[#eee7d6] p-6 text-center shadow-2xl">
            <p className="text-xs tracking-[0.22em] text-[#2c1810]/55">
              战局已定
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-[0.14em]">
              {view.latestResolution?.outcome.battleEnded &&
              view.latestResolution.outcome.winnerTeamId === view.teamId
                ? '此阵得胜'
                : '此阵惜败'}
            </h2>
            <p className="mt-3 text-sm text-[#2c1810]/60">
              战斗结果已确认，完整回放正在归档。
            </p>
            <Link
              to="/game/battle/history"
              className="mt-5 inline-block border border-[#8f2433]/50 px-4 py-2 text-sm text-[#8f2433]"
            >
              查看战斗记录
            </Link>
          </section>
        </div>
      )}

      {view?.status === 'cancelled' && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-[#2c1810]/35 px-4 backdrop-blur-[2px]">
          <section className="w-full max-w-sm border border-[#2c1810]/25 bg-[#eee7d6] p-6 text-center shadow-2xl">
            <p className="text-xs tracking-[0.22em] text-[#2c1810]/55">
              对局已结束
            </p>
            <h2 className="mt-2 text-xl font-semibold">本场对局已取消</h2>
            <Link
              to="/game/battle/history"
              className="mt-5 inline-block border border-[#2c1810]/40 px-4 py-2 text-sm"
            >
              返回战斗记录
            </Link>
          </section>
        </div>
      )}
    </main>
  );
}
