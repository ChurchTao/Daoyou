import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import type { ContestBrewCommand } from '@daoyou/contracts/alchemy/contest';
import {
  CONTEST_ATTEMPTS,
  CONTEST_HEAT,
} from '@daoyou/game-domain/alchemy/contest';
import { useEffect, useRef, useState } from 'react';
import { ContestFurnace } from './ContestFurnace';
import { ContestFurnaceSlots, ContestMaterialRack } from './ContestMaterials';
import { ContestModal } from './ContestModal';
import { ContestReceipt } from './ContestReceipt';
import { ContestTicket } from './ContestTicket';
import {
  contestFurnacePositions,
  draftFor,
  heatNames,
  heatNotes,
  heatOptions,
  readDraft,
  type ContestSession,
} from './presentation';

type Overlay = { kind: 'rack' | 'finish' } | { kind: 'receipt'; index: number };

export function ContestWorkbench({
  week,
  session,
  seconds,
  settled,
  pending,
  rankHref,
  brew,
  finish,
}: {
  week: string;
  session: ContestSession;
  seconds: number;
  settled: boolean;
  pending: 'start' | 'brew' | 'finish' | null;
  rankHref: string;
  brew: (input: ContestBrewCommand) => Promise<unknown>;
  finish: () => Promise<unknown>;
}) {
  const storageKey = `daoyou:alchemy-contest:${week}:${session.deadline}`;
  const [saved, setDraft] = useState(() => readDraft(storageKey, session));
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const retry = useRef<{ recipe: string; id: string } | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const result = useRef<HTMLHeadingElement>(null);
  const furnaceHeading = useRef<HTMLHeadingElement>(null);
  const rackPane = useRef<HTMLElement>(null);
  const turn = session.attempts.length;
  const last = session.attempts.at(-1);
  const remainingTurns = CONTEST_ATTEMPTS - turn;
  const firing = pending === 'brew';
  const ended =
    !firing && (session.finished || seconds <= 0 || remainingTurns === 0);
  const reviewingNew = !pending && saved.turn < turn;
  const receiptIndex = reviewingNew
    ? turn - 1
    : overlay?.kind === 'receipt'
      ? overlay.index
      : -1;
  const receipt = session.attempts[receiptIndex];
  const confirming = overlay?.kind === 'finish' && !ended && !receipt;
  const draft = saved.turn === turn ? saved : draftFor(session, saved.heat);
  const total = draft.doses.reduce((sum, { dose }) => sum + dose, 0);
  const blocked =
    draft.doses.length < 2
      ? '至少投 2 味材料'
      : total < 3
        ? '至少投 3 份材料'
        : '';

  useEffect(() => {
    if (saved.turn !== turn || ended) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {
      /* In-memory draft stays usable. */
    }
  }, [saved, turn, storageKey, ended]);

  useEffect(() => {
    if (ended) scroll.current?.scrollTo({ top: 0, behavior: 'instant' });
  }, [ended]);

  function maxDose(materialId: string) {
    const existing =
      draft.doses.find((dose) => dose.materialId === materialId)?.dose ?? 0;
    if (!existing && draft.doses.length >= 4) return 0;
    return Math.min(
      2,
      session.remaining[materialId] ?? 0,
      5 - total + existing,
    );
  }

  function setDose(materialId: string, dose: number) {
    if (
      pending ||
      ended ||
      dose < 0 ||
      dose > maxDose(materialId) ||
      !Number.isInteger(dose)
    )
      return;
    const existing = draft.doses.some((item) => item.materialId === materialId);
    setDraft({
      ...draft,
      doses: existing
        ? draft.doses.flatMap((item) =>
            item.materialId !== materialId
              ? [item]
              : dose
                ? [{ materialId, dose }]
                : [],
          )
        : [...draft.doses, { materialId, dose }],
    });
  }

  function openRack() {
    if (window.matchMedia('(min-width: 768px)').matches)
      rackPane.current?.querySelector('button')?.focus();
    else setOverlay({ kind: 'rack' });
  }

  function submit() {
    if (blocked || pending || ended) return;
    const command = {
      week,
      expectedAttempts: turn,
      heat: draft.heat,
      doses: draft.doses,
    };
    const recipe = JSON.stringify(command);
    if (retry.current?.recipe !== recipe)
      retry.current = { recipe, id: crypto.randomUUID() };
    setOverlay(null);
    void brew({ ...command, requestId: retry.current.id });
  }

  function closeModal(copy = false) {
    if (pending === 'finish') return;
    if (reviewingNew && last) {
      setDraft(draftFor(session, last.heat, copy ? last.doses : []));
      requestAnimationFrame(() => {
        (ended ? result : furnaceHeading).current?.focus();
      });
    }
    setOverlay(null);
  }

  const rack = (
    <ContestMaterialRack
      session={session}
      draft={draft}
      locked={!!pending}
      maxDose={maxDose}
      setDose={setDose}
    />
  );

  return (
    <div className="contest-workbench" data-view={ended ? 'final' : 'brew'}>
      <ContestTicket
        session={session}
        seconds={seconds}
        ended={ended}
        busy={!!pending}
        firing={firing}
        showReceipt={(index) => setOverlay({ kind: 'receipt', index })}
        confirmFinish={() => setOverlay({ kind: 'finish' })}
      />

      <div className="contest-scroll" ref={scroll}>
        <div className="contest-stage">
          <section className="contest-stage-art" aria-label="玄火丹炉">
            {!ended && (
              <header className="contest-hearth-header">
                <h3 ref={furnaceHeading} tabIndex={-1}>
                  玄火丹炉
                </h3>
                <InkButton
                  variant="secondary"
                  className="contest-rack-toggle"
                  disabled={firing}
                  onClick={openRack}
                >
                  选材料
                </InkButton>
              </header>
            )}
            <ContestFurnace
              heat={ended ? (last?.heat ?? draft.heat) : draft.heat}
              occupied={draft.doses.length}
              firing={firing}
              count={turn}
            >
              {!ended && (
                <ContestFurnaceSlots
                  session={session}
                  draft={draft}
                  maxDose={maxDose}
                  setDose={setDose}
                  locked={!!pending}
                  openRack={openRack}
                  positions={contestFurnacePositions}
                />
              )}
            </ContestFurnace>
            {firing && (
              <GameLoadingState
                variant="inline"
                immediate
                message="正在凝丹…"
                className="contest-firing-status"
              />
            )}
          </section>
          {ended ? (
            <section className="contest-final">
              <h3 ref={result} tabIndex={-1}>
                本场成绩
              </h3>
              {session.standing ? (
                <>
                  <p className="contest-final-score">
                    <b className="font-mono">{session.standing.score}</b> 分
                  </p>
                  <p>
                    第{' '}
                    <b className="font-mono">{session.standing.bestAttempt}</b>{' '}
                    炉得分最高。总分已计入节材和节气加分。
                  </p>
                </>
              ) : (
                <p>本场没有丹药达标，不计入炼丹榜。</p>
              )}
              {session.standing && (
                <p>{settled ? '本期名次已公布。' : '封榜后可查看名次。'}</p>
              )}
              <InkButton variant="primary" href={rankHref}>
                查看炼丹榜
              </InkButton>
            </section>
          ) : (
            <aside
              ref={rackPane}
              className="contest-shelf"
              aria-label="参赛材料"
            >
              <h3>参赛材料</h3>
              {rack}
            </aside>
          )}
        </div>
      </div>

      {!ended && (
        <footer className="contest-dock">
          <div className="contest-draft">
            <span>
              待入炉 <b className="font-mono">{draft.doses.length}</b> 味 ·{' '}
              <b className="font-mono">{total}</b> 份
            </span>
            <span>
              炉气 <b className="font-mono">{session.qi}</b>
            </span>
          </div>
          <div className="contest-heat" role="group" aria-label="火候">
            {heatOptions.map((heat) => (
              <button
                key={heat}
                type="button"
                aria-pressed={draft.heat === heat}
                disabled={!!pending || CONTEST_HEAT[heat] > session.qi}
                onClick={() => setDraft({ ...draft, heat })}
              >
                <span>
                  {heatNames[heat]}{' '}
                  <b className="font-mono">{CONTEST_HEAT[heat]}</b> 气
                </span>
                <small>{heatNotes[heat]}</small>
              </button>
            ))}
          </div>
          <div className="contest-submit">
            {!firing && (
              <div>
                {blocked ? (
                  <p>{blocked}</p>
                ) : (
                  <>
                    <p>
                      扣 <b className="font-mono">{total}</b> 份 ·{' '}
                      <b className="font-mono">{CONTEST_HEAT[draft.heat]}</b> 气
                      · <b className="font-mono">1</b> 炉
                    </p>
                    <small>未达标或未成丹，消耗照扣</small>
                  </>
                )}
              </div>
            )}
            <InkButton
              variant="primary"
              className="contest-main-action"
              disabled={!!blocked}
              pending={firing}
              pendingLabel="凝丹中…"
              onClick={submit}
            >
              投料开炉
            </InkButton>
          </div>
        </footer>
      )}

      <InkDetailDrawer
        isOpen={overlay?.kind === 'rack' && !ended && !receipt}
        onClose={() => setOverlay(null)}
        title="参赛材料"
        size="md"
        className="contest-drawer-transition"
        closeLabel="返回丹炉"
      >
        {rack}
      </InkDetailDrawer>

      <ContestModal
        open={!!receipt || confirming}
        title={receipt ? `第 ${receiptIndex + 1} 炉 · 验丹` : '提前结算'}
        onClose={() => closeModal()}
        footer={
          receipt ? (
            reviewingNew && !ended ? (
              <>
                <InkButton variant="secondary" onClick={() => closeModal()}>
                  另配一炉
                </InkButton>
                <InkButton variant="primary" onClick={() => closeModal(true)}>
                  沿用配方
                </InkButton>
              </>
            ) : (
              <InkButton variant="secondary" onClick={() => closeModal()}>
                关闭
              </InkButton>
            )
          ) : (
            <>
              <InkButton
                variant="secondary"
                disabled={pending === 'finish'}
                onClick={() => closeModal()}
              >
                继续炼丹
              </InkButton>
              <InkButton
                variant="primary"
                pending={pending === 'finish'}
                pendingLabel="正在结算…"
                onClick={() => void finish().then(() => setOverlay(null))}
              >
                确认结算
              </InkButton>
            </>
          )
        }
      >
        {receipt ? (
          <ContestReceipt attempt={receipt} session={session} />
        ) : (
          <div className="contest-finish-copy">
            <p>
              {session.standing ? (
                <>
                  当前总分 <b className="font-mono">{session.standing.score}</b>{' '}
                  分。
                </>
              ) : (
                '目前还没有丹药达标。'
              )}
            </p>
            <p>
              结算后，剩余 <b className="font-mono">{remainingTurns}</b>{' '}
              炉无法再用。
            </p>
          </div>
        )}
      </ContestModal>
    </div>
  );
}
