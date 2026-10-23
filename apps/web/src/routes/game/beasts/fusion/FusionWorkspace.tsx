import {
  combatV6Request,
  CombatV6RequestError,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import {
  BeastFusionRequestSchema,
  type BeastFusionRequest,
  type BeastFusionResponse,
  type BeastManagementView,
} from '@daoyou/contracts/beasts';
import { BEAST_FUSION } from '@daoyou/game-content/beasts';
import type { BeastLineup, SummonedBeast } from '@daoyou/game-domain/beasts';
import { beastFusionReason } from '@daoyou/game-rules/beasts/fusion';
import { carriedBeastIds } from '@daoyou/game-rules/beasts/growth';
import { useCallback, useRef, useState } from 'react';
import { BeastPickerDrawer } from './BeastPickerDrawer';
import { FusionBeastPanel } from './FusionBeastPanel';
import { FusionPreview } from './FusionPreview';

const base = '/api/combat-v6/beasts';

export function FusionWorkspace({
  ownerId,
  ownerLevel,
  lineup,
  initialBeast,
  closeLabel,
  onClose,
  onRoster,
  onViewResult,
}: {
  ownerId: string;
  ownerLevel?: number;
  lineup?: BeastLineup;
  initialBeast?: SummonedBeast;
  closeLabel: string;
  onClose: () => void;
  onRoster?: (view: BeastManagementView) => void;
  onViewResult: (beast: SummonedBeast, inBag: boolean) => void;
}) {
  const storageKey = `beast-fusion:${ownerId}`;
  const [meta, setMeta] = useState<
    { ownerLevel: number; lineup: BeastLineup } | undefined
  >(ownerLevel !== undefined && lineup ? { ownerLevel, lineup } : undefined);
  const [selected, setSelected] = useState<[SummonedBeast?, SummonedBeast?]>(
    () => [initialBeast?.isLocked ? undefined : initialBeast, undefined],
  );
  const [slot, setSlot] = useState<0 | 1>();
  const [preview, setPreview] = useState(false);
  const [help, setHelp] = useState(false);
  const [result, setResult] = useState<SummonedBeast>();
  const [resultInBag, setResultInBag] = useState(false);
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
  const level = ownerLevel ?? meta?.ownerLevel;
  const activeLineup = lineup ?? meta?.lineup;
  const [first, second] = selected;
  const reason =
    first && second && level !== undefined
      ? beastFusionReason(first, second, level)
      : '请在两侧各选择一只灵兽';
  const locked = pending || !!request;
  const rememberMeta = useCallback(
    (next: { ownerLevel: number; lineup: BeastLineup }) => setMeta(next),
    [],
  );
  const placementNote = [
    '有空位时进入灵兽袋，否则寄入仓库，不自动成为首发。',
    activeLineup &&
    [first, second].some(
      (beast) => beast && activeLineup.leadBeastId === beast.id,
    )
      ? '当前首发会空出。'
      : '',
  ]
    .filter(Boolean)
    .join('');

  function select(beast: SummonedBeast | undefined, index: 0 | 1) {
    if (locked) return;
    setSelected((current) =>
      index === 0 ? [beast, current[1]] : [current[0], beast],
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
      const inBag = carriedBeastIds(
        response.view.beasts,
        response.view.lineup,
      ).includes(response.result.id);
      setMeta({
        ownerLevel: response.view.ownerLevel,
        lineup: response.view.lineup,
      });
      onRoster?.(response.view);
      setResultInBag(inBag);
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
    if (openBeast) onViewResult(result, resultInBag);
    else {
      setRequest(undefined);
      setResult(undefined);
      setSelected([]);
      setError('');
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <InkButton variant="secondary" disabled={pending} onClick={onClose}>
          {closeLabel}
        </InkButton>
        <InkButton
          onClick={() => setHelp(true)}
          variant="ghost"
          disabled={pending}
        >
          玩法说明
        </InkButton>
      </div>
      {error ? (
        <p role="alert" className="text-crimson mb-4 text-sm">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="animate-fade-in mx-auto max-w-sm">
          <p role="status" className="text-teal mb-5 text-center text-sm">
            炉烟散去，新的灵兽与你结缘。
          </p>
          <FusionBeastPanel beast={result} />
          <p className="text-ink-secondary mt-5 text-center text-xs">
            {resultInBag
              ? '新灵兽已收入灵兽袋，可继续培养与分配属性。'
              : '灵兽袋已满，新灵兽已寄入仓库。'}
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
            若上次融合尚未揭晓，会接着完成同一次。
          </p>
          <InkButton variant="primary" onClick={() => void submit()}>
            恢复本次融合结果
          </InkButton>
        </div>
      ) : (
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
      )}
      {slot !== undefined ? (
        <BeastPickerDrawer
          side={slot === 0 ? '左' : '右'}
          excludeId={selected[slot === 0 ? 1 : 0]?.id}
          selectedId={selected[slot]?.id}
          onClose={() => setSlot(undefined)}
          onSelect={(beast) => select(beast, slot)}
          onMeta={rememberMeta}
        />
      ) : null}
      {preview && first && second ? (
        <FusionPreview
          first={first}
          second={second}
          reason={reason}
          note={placementNote}
          pending={pending}
          onClose={() => {
            if (!busy.current) setPreview(false);
          }}
          onConfirm={() => void submit()}
        />
      ) : null}
      {help ? (
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
              级，并符合主人等级与携带要求。在灵兽袋或仓库中都可以，不必先转移。
            </li>
            <li>
              对照资质、成长与技能，点击技能可查看效果。变异灵兽不能参与融合。
            </li>
            <li>
              打开预览，看看可能获得哪只灵兽。融合后技能可能变少，资质和成长也可能变差。
            </li>
            <li>
              确认后消耗双方，获得一只新灵兽。左右互换，结果相同，不额外收取灵石。若材料在灵兽袋中，会离开携带；若是首发，首发会空出。
            </li>
          </ol>
        </InkDetailDrawer>
      ) : null}
    </div>
  );
}
