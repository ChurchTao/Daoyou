import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import {
  combatV6Request,
  CombatV6RequestError,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameLoadingState } from '@app/components/game-shell/GameLoadingState';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useCultivatorIdentity } from '@app/lib/resources/player';
import {
  BeastFusionRequestSchema,
  type BeastFusionRequest,
  type BeastFusionResponse,
  type BeastManagementView,
} from '@shared/contracts/combatV6Beasts';
import type { SummonedBeast } from '@shared/engine/combat-v6/beasts';
import {
  beastFusionMaterialReason,
  beastFusionReason,
} from '@shared/engine/combat-v6/beasts/fusion';
import { BEAST_FUSION } from '@shared/engine/combat-v6/beasts/fusion-config';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { FusionBeastPanel, FusionIdentityTag } from './FusionBeastPanel';
import { FusionPreview } from './FusionPreview';

const base = '/api/combat-v6/beasts';

export default function BeastFusionPage() {
  const identity = useCultivatorIdentity();
  const ownerId = identity.data?.cultivator?.id;
  return (
    <GameSceneFrame variant="workflow">
      {ownerId ? (
        <FusionWorkspace key={ownerId} ownerId={ownerId} />
      ) : (
        <GameLoadingState variant="inline" message="正在寻访灵兽……" />
      )}
    </GameSceneFrame>
  );
}

function FusionWorkspace({ ownerId }: { ownerId: string }) {
  const navigate = useNavigate();
  const storageKey = `beast-fusion:${ownerId}`;
  const [view, setView] = useState<BeastManagementView>();
  const [loadError, setLoadError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [selected, setSelected] = useState<[string?, string?]>([]);
  const [slot, setSlot] = useState<0 | 1>();
  const [preview, setPreview] = useState(false);
  const [help, setHelp] = useState(false);
  const [result, setResult] = useState<SummonedBeast>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [request, setRequest] = useState<BeastFusionRequest | undefined>(() => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;
    try {
      return BeastFusionRequestSchema.parse(JSON.parse(raw));
    } catch {
      sessionStorage.removeItem(storageKey);
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<BeastManagementView>(base, {
      signal: controller.signal,
    })
      .then((next) => {
        if (!controller.signal.aborted) {
          setView(next);
          setLoadError('');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setLoadError(e instanceof Error ? e.message : '灵兽读取失败');
      });
    return () => controller.abort();
  }, [refresh]);

  const first = view?.beasts.find((b) => b.id === selected[0]);
  const second = view?.beasts.find((b) => b.id === selected[1]);
  const reason =
    first && second && view
      ? beastFusionReason(first, second, view.ownerLevel, view.lineup)
      : '请在两侧各选择一只灵兽';
  const locked = pending || !!request;

  function select(beastId: string | undefined, index: 0 | 1) {
    if (locked) return;
    setSelected((current) =>
      index === 0 ? [beastId, current[1]] : [current[0], beastId],
    );
    setSlot(undefined);
    setError('');
  }

  async function submit() {
    if (busy.current || (!request && reason)) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const input =
        request ??
        BeastFusionRequestSchema.parse({
          requestId: crypto.randomUUID(),
          parents: [first, second].map((beast) => ({
            beastId: beast!.id,
            expectedRevision: beast!.revision,
          })),
        });
      // Save before sending so navigation, reloads and lost responses reuse this roll.
      sessionStorage.setItem(storageKey, JSON.stringify(input));
      setRequest(input);
      const previous = await combatV6Request<BeastFusionResponse | null>(
        `${base}/fusions/${input.requestId}`,
      );
      const response =
        previous ??
        (await combatV6Request<BeastFusionResponse>(
          `${base}/fuse`,
          mutationBody(input),
        ));
      setView(response.view);
      setResult(response.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '结果读取失败，请重试');
      if (
        e instanceof CombatV6RequestError &&
        e.code === 'BEAST_FUSION_REJECTED'
      ) {
        sessionStorage.removeItem(storageKey);
        setRequest(undefined);
        setSelected([]);
        setRefresh((value) => value + 1);
      }
    } finally {
      setPreview(false);
      busy.current = false;
      setPending(false);
    }
  }

  function acknowledge(openBeast: boolean) {
    if (!result || busy.current) return;
    sessionStorage.removeItem(storageKey);
    if (openBeast) navigate(`/game/beasts?beast=${result.id}`);
    else {
      setRequest(undefined);
      setResult(undefined);
      setSelected([]);
      setError('');
      setRefresh((value) => value + 1);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <InkButton href="/game/beasts" variant="secondary" disabled={pending}>
          返回灵兽袋
        </InkButton>
        <InkButton
          onClick={() => setHelp(true)}
          variant="ghost"
          disabled={pending}
        >
          玩法说明
        </InkButton>
      </div>
      {error && (
        <p role="alert" className="text-crimson mb-4 text-sm">
          {error}
        </p>
      )}
      {result ? (
        <div className="animate-fade-in mx-auto max-w-sm">
          <p role="status" className="text-teal mb-5 text-center text-sm">
            炉烟散去，新的灵兽与你结缘。
          </p>
          <FusionBeastPanel beast={result} />
          <p className="text-ink-secondary mt-5 text-center text-xs">
            新灵兽已收入灵兽袋，可继续培养与分配属性。
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <InkButton onClick={() => acknowledge(false)}>继续融合</InkButton>
            <InkButton variant="primary" onClick={() => acknowledge(true)}>
              查看新灵兽
            </InkButton>
          </div>
        </div>
      ) : request && !pending ? (
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <GameIcon
            purpose="artwork"
            value="icon:beast-fusion-cauldron"
            className="text-[160px]"
          />
          <p className="text-sm">还有一场融合等待揭晓</p>
          <p className="text-ink-secondary max-w-sm text-sm leading-7">
            恢复时会查询原记录；若尚未完成，将继续同一次融合。
          </p>
          <InkButton variant="primary" onClick={() => void submit()}>
            恢复本次融合结果
          </InkButton>
        </div>
      ) : !view ? (
        loadError ? (
          <div role="alert" className="space-y-3 py-8 text-center">
            <p className="text-crimson text-sm">{loadError}</p>
            <InkButton onClick={() => setRefresh((value) => value + 1)}>
              重新加载
            </InkButton>
          </div>
        ) : (
          <GameLoadingState variant="inline" message="正在寻访灵兽……" />
        )
      ) : (
        <>
          {loadError && (
            <p role="alert" className="text-crimson mb-3 text-sm">
              {loadError}
              <InkButton onClick={() => setRefresh((value) => value + 1)}>
                重新加载
              </InkButton>
            </p>
          )}
          <div className="grid grid-cols-2 items-start gap-x-4 gap-y-6 sm:gap-x-6 md:grid-cols-[minmax(0,1fr)_180px_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_220px_minmax(0,1fr)]">
            <FusionBeastPanel
              side="左"
              beast={first}
              locked={locked}
              onSelect={() => setSlot(0)}
              onRemove={() => select(undefined, 0)}
            />
            <div
              className="order-last col-span-2 flex flex-col items-center justify-center self-center md:order-none md:col-span-1"
              aria-busy={pending}
            >
              <div className="relative flex w-full items-center justify-center">
                <div
                  aria-hidden
                  className="border-ink/15 absolute inset-x-0 top-1/2 border-t border-dashed"
                />
                <GameIcon
                  purpose="artwork"
                  value="icon:beast-fusion-cauldron"
                  className={`relative text-[120px] md:text-[180px] lg:text-[210px] ${pending ? 'motion-safe:animate-pulse' : ''}`}
                />
              </div>
              <InkButton
                variant="primary"
                className="mt-3 min-h-11"
                pending={pending}
                pendingLabel="正在融合……"
                disabled={!!reason || !!request}
                onClick={() => setPreview(true)}
              >
                预览并融合
              </InkButton>
              <p
                role="status"
                className="text-ink-secondary mt-2 max-w-64 text-center text-xs leading-6"
              >
                {pending
                  ? '灵息正在交汇，请稍候。'
                  : reason || '灵息已相合，可查看新生的可能。'}
              </p>
            </div>
            <FusionBeastPanel
              side="右"
              beast={second}
              locked={locked}
              onSelect={() => setSlot(1)}
              onRemove={() => select(undefined, 1)}
            />
          </div>
          {!view.beasts.length && (
            <p className="text-ink-secondary mt-6 text-center text-sm">
              灵兽袋尚空，先在野外结识灵兽伙伴吧。
            </p>
          )}
        </>
      )}
      {slot !== undefined && view && (
        <InkDetailDrawer
          isOpen
          title={`选择${slot === 0 ? '左' : '右'}侧灵兽`}
          description={`选择达到 ${BEAST_FUSION.minimumLevel} 级、未携带的普通灵兽。`}
          onClose={() => setSlot(undefined)}
          size="md"
        >
          <div className="space-y-2" role="group" aria-label="可选灵兽">
            {view.beasts.map((beast) => {
              const blocked =
                beast.id === selected[slot === 0 ? 1 : 0]
                  ? '已选入另一侧'
                  : beastFusionMaterialReason(
                      beast,
                      view.ownerLevel,
                      view.lineup,
                    );
              return (
                <button
                  type="button"
                  key={beast.id}
                  disabled={!!blocked}
                  aria-pressed={selected[slot] === beast.id}
                  onClick={() => select(beast.id, slot)}
                  className={`focus-visible:outline-teal flex min-h-20 w-full items-center gap-3 border-l-2 px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${selected[slot] === beast.id ? 'border-teal bg-teal/8' : 'hover:bg-ink/5 border-transparent'}`}
                >
                  <BeastIcon
                    speciesId={beast.speciesId}
                    isMutant={beast.isMutant}
                    className="text-5xl"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1 text-sm">
                      {beast.name}
                      <FusionIdentityTag beast={beast} />
                    </span>
                    <span className="text-ink-secondary mt-1 block text-xs">
                      <span className="font-mono">{beast.level}</span> 级 ·{' '}
                      <span className="font-mono">{beast.skills.length}</span>{' '}
                      技能 · 成长{' '}
                      <span className="font-mono">
                        {beast.growth.toFixed(3)}
                      </span>
                    </span>
                    {blocked && (
                      <span className="text-ink-secondary mt-2 block text-xs">
                        {blocked}
                      </span>
                    )}
                  </span>
                  {selected[slot] === beast.id && (
                    <span className="text-teal text-xs">已选</span>
                  )}
                </button>
              );
            })}
            {!view.beasts.length && (
              <p className="text-ink-secondary py-8 text-center text-sm">
                尚未拥有灵兽
              </p>
            )}
          </div>
        </InkDetailDrawer>
      )}
      {preview && first && second && (
        <FusionPreview
          first={first}
          second={second}
          reason={reason}
          pending={pending}
          onClose={() => {
            if (!busy.current) setPreview(false);
          }}
          onConfirm={() => void submit()}
        />
      )}
      {help && (
        <InkDetailDrawer
          isOpen
          title="融合须知"
          onClose={() => setHelp(false)}
          size="sm"
        >
          <ol className="list-decimal space-y-5 pl-5 text-sm leading-7">
            <li>
              将两只普通灵兽分别选入左右两侧。双方须达到{' '}
              <span className="font-mono">{BEAST_FUSION.minimumLevel}</span>{' '}
              级，符合主人等级与携带要求，并移出携带编组。
            </li>
            <li>
              对照资质、成长与技能，点击技能可查看效果。变异灵兽不能参与融合。
            </li>
            <li>
              打开预览，看看可能获得哪只灵兽。融合后技能可能变少，资质和成长也可能变差。
            </li>
            <li>
              确认后消耗双方，获得一只新灵兽。双方地位相同，交换左右不会改变概率，不额外收取灵石。
            </li>
          </ol>
        </InkDetailDrawer>
      )}
    </div>
  );
}
