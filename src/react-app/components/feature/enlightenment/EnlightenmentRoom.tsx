import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkModal } from '@app/components/layout/InkModal';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { CHARACTER_MANUALS_V1 } from '@shared/engine/combat-v6/manuals/content';
import { cn } from '@shared/lib/cn';
import {
  ENLIGHTENMENT_REALMS,
  enlightenmentQualityCap,
} from '@shared/manuals/enlightenment';
import { REALM_VALUES } from '@shared/types/constants';
import { useState } from 'react';
import { InventoryHeader } from '../items/InventoryHeader';
import { InventoryItems } from '../items/InventoryItems';
import { ItemSlot } from '../items/ItemSlot';
import {
  useEnlightenmentSession,
  type EnlightenmentSession,
} from './useEnlightenmentSession';

const positions = [
  'left-[12%] top-[24%]',
  'left-[88%] top-[24%]',
  'left-[12%] top-[76%]',
  'left-[88%] top-[76%]',
];
const percent = (value: number) => `${Number((value * 100).toFixed(2))}%`;

function Probabilities({ session }: { session: EnlightenmentSession }) {
  if (!session.preview) return null;
  return (
    <div className="space-y-1 text-xs" aria-label="本次产出概率">
      {ENLIGHTENMENT_REALMS.map((realm, i) =>
        session.preview!.probabilities[i] > 0 ? (
          <p key={realm} className="flex flex-wrap justify-between gap-x-3">
            <span>
              {realm}功法
              {session.view &&
              REALM_VALUES.indexOf(realm) >
                REALM_VALUES.indexOf(session.view.realm) ? (
                <span className="text-ink-secondary"> · 尚不可修习</span>
              ) : null}
            </span>
            <span className="font-mono">
              {percent(session.preview!.probabilities[i])}
            </span>
          </p>
        ) : null,
      )}
      {session.preview.successChance < 1 ? (
        <p className="text-ink-secondary flex justify-between gap-3">
          <span>未能悟得功法</span>
          <span className="font-mono">
            {percent(1 - session.preview.successChance)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
function MaterialPicker({ session }: { session: EnlightenmentSession }) {
  return (
    <div className="space-y-3 text-sm">
      <InventoryHeader capacity={<>{session.inventory?.used ?? '—'} / 40</>} />
      <p className="text-ink-secondary text-xs">
        {session.view
          ? `可参悟${enlightenmentQualityCap(session.view.realm)}及以下功法典籍`
          : '正在核对境界……'}
      </p>
      <InventoryItems
        items={session.inventory?.items ?? []}
        slotProps={(item) => {
          const reason = item ? session.itemProblem(item) : null;
          const used = item ? (session.quantities.get(item.id) ?? 0) : 0;
          const unavailable = !!reason || (!!item && used >= item.quantity);
          return {
            disabled: session.locked || unavailable,
            badge: used ? `已选${used}` : item && !reason ? '可选' : undefined,
            onQuickAction: item ? () => session.choose(item) : undefined,
            children: item
              ? (close) => (
                  <>
                    {reason ? (
                      <p className="text-ink-secondary">{reason}</p>
                    ) : null}
                    <InkButton
                      disabled={session.locked || unavailable}
                      onClick={() => {
                        session.choose(item);
                        close();
                      }}
                    >
                      放入一本
                    </InkButton>
                  </>
                )
              : undefined,
          };
        }}
      />
    </div>
  );
}

export function EnlightenmentRoom({ ownerId }: { ownerId: string }) {
  const session = useEnlightenmentSession(ownerId);
  const [drawer, setDrawer] = useState<'bag' | 'confirm'>();
  const [revealedRequest, setRevealedRequest] = useState('');
  const result = session.result;
  const revealed = !!result && revealedRequest === result.requestId;
  const manual = result?.jadeDefinitionId
    ? CHARACTER_MANUALS_V1.find(
        (m) => `jade.${m.id}` === result.jadeDefinitionId,
      )
    : undefined;
  function openBag() {
    if (window.matchMedia('(max-width: 767px)').matches) setDrawer('bag');
    else document.getElementById('enlightenment-materials')?.focus();
  }
  return (
    <GameSceneFrame variant="workflow">
      <div className="space-y-5 text-sm">
        <p className="text-ink-secondary leading-6">
          卷帙静陈，灵气微动。择几卷典籍，静心参悟其中法理。
        </p>
        {session.error ? (
          <p role="alert" className="text-crimson">
            {session.error}{' '}
            <InkButton disabled={session.pending} onClick={session.reload}>
              重新核对
            </InkButton>
          </p>
        ) : null}
        {session.unresolved && !session.pending ? (
          <div role="status" className="space-y-2">
            <p>有一次参悟尚待核对，请先确认本次结果。</p>
            <InkButton
              disabled={session.pending}
              onClick={() => void session.submit()}
            >
              核对本次结果
            </InkButton>
          </div>
        ) : null}
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <section className="min-w-0">
            <div
              className="relative mx-auto aspect-square w-full max-w-lg"
              aria-label="四格典籍参悟台"
            >
              <img
                src={`/assets/manuals/cultivator-${session.view?.gender === '女' ? 'female' : 'male'}-meditation.webp`}
                alt="静坐参悟的修士"
                width={960}
                height={960}
                draggable={false}
                className={cn(
                  'pointer-events-none absolute inset-[8%] h-[84%] w-[84%] object-contain select-none',
                  session.pending && 'motion-safe:animate-pulse',
                )}
              />
              {positions.map((position, index) => {
                const id = session.slots[index];
                const item = id ? session.byId.get(id) : undefined;
                return (
                  <div
                    key={index}
                    className={cn(
                      'absolute w-[23%] -translate-x-1/2 -translate-y-1/2',
                      position,
                    )}
                  >
                    <ItemSlot
                      item={item ? { ...item, quantity: 1 } : undefined}
                      className="w-full"
                      emptyLabel="放入典籍"
                      emptyIcon="＋"
                      disabled={session.locked}
                      onQuickAction={() =>
                        item ? session.remove(index) : openBag()
                      }
                    >
                      {item
                        ? (close) => (
                            <InkButton
                              disabled={session.locked}
                              onClick={() => {
                                session.remove(index);
                                close();
                              }}
                            >
                              移出典籍
                            </InkButton>
                          )
                        : undefined}
                    </ItemSlot>
                  </div>
                );
              })}
              {result ? (
                <div className="absolute inset-x-[29%] top-[40%] text-center">
                  <div
                    onAnimationEnd={(event) => {
                      if (event.target === event.currentTarget)
                        setRevealedRequest(result.requestId);
                    }}
                    className={cn(
                      'bg-paper/95 rounded px-3 py-4',
                      !revealed &&
                        'animate-[forge-reveal_1100ms_ease-out_both] motion-reduce:[animation-duration:1ms]',
                    )}
                  >
                    {manual ? (
                      <ItemSlot
                        item={{
                          definitionId: result.jadeDefinitionId!,
                          name: manual.name,
                          quantity: 1,
                          instanceData: null,
                        }}
                        disabled={!revealed}
                        className="w-full"
                        quantityLabel="奖励"
                      />
                    ) : (
                      <>
                        <GameIcon value="📜" className="mx-auto text-3xl" />
                        <p className="mt-2 text-xs">义理未通</p>
                      </>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            {result ? (
              <div className="space-y-3 text-center" aria-live="polite">
                {revealed ? (
                  <>
                    <p>
                      {manual
                        ? `悟得《${manual.name}》`
                        : '诸般义理尚未贯通，本次未能悟得功法。'}
                    </p>
                    {manual ? (
                      <p className="text-ink-secondary text-xs">
                        {manual.realm}功法 · 玉简已收入储物袋
                      </p>
                    ) : null}
                    <p className="text-ink-secondary text-xs">
                      本次消耗{' '}
                      <span className="font-mono">{result.cost.qi}</span>{' '}
                      天地灵气 ·{' '}
                      <span className="font-mono">{result.cost.insight}</span>{' '}
                      道心感悟
                    </p>
                    <InkButton
                      variant="primary"
                      onClick={session.continueEnlightenment}
                    >
                      继续参悟
                    </InkButton>
                  </>
                ) : (
                  <>
                    <p>卷中文字渐入心间……</p>
                    <InkButton
                      onClick={() => setRevealedRequest(result.requestId)}
                    >
                      查看结果
                    </InkButton>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <p>
                    {session.preview ? (
                      <>
                        成功率{' '}
                        <span className="font-mono">
                          {percent(session.preview.successChance)}
                        </span>
                        {session.preview.successChance === 1
                          ? ' · 必定有所领悟'
                          : null}
                      </>
                    ) : (
                      '每本典籍增加 25% 成功率'
                    )}
                  </p>
                  <InkButton
                    className="md:hidden"
                    disabled={session.locked}
                    onClick={openBag}
                  >
                    选择典籍
                  </InkButton>
                </div>
                <Probabilities session={session} />
                <footer className="border-ink/10 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="space-y-1 text-xs">
                    {session.preview ? (
                      <>
                        <p>
                          <span className="font-mono">
                            {session.preview.cost.qi}
                          </span>{' '}
                          天地灵气 ·{' '}
                          <span className="font-mono">
                            {session.preview.cost.insight}
                          </span>{' '}
                          道心感悟
                        </p>
                        {session.preview.cost.insight !==
                        session.preview.cost.baseInsight ? (
                          <p className="text-ink-secondary">
                            命格减免前：
                            <span className="font-mono">
                              {session.preview.cost.baseInsight}
                            </span>{' '}
                            感悟
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p>选择典籍后确定消耗</p>
                    )}
                    <p className="text-ink-secondary" role="status">
                      {session.pending ? '正在静心参悟……' : session.problem}
                    </p>
                  </div>
                  <InkButton
                    variant="primary"
                    pending={session.pending}
                    pendingLabel="参悟中……"
                    disabled={session.locked || !!session.problem}
                    onClick={() => setDrawer('confirm')}
                  >
                    开始参悟
                  </InkButton>
                </footer>
              </div>
            )}
          </section>
          <aside
            id="enlightenment-materials"
            tabIndex={-1}
            className="border-ink/10 hidden min-w-0 border-l pl-5 focus-visible:outline-none md:block"
          >
            <MaterialPicker session={session} />
          </aside>
        </div>
        <details className="border-ink/10 border-t pt-3 text-xs leading-6">
          <summary className="text-ink-secondary cursor-pointer">
            参悟之理
          </summary>
          <div className="text-ink-secondary mt-3 space-y-2">
            <p>
              选入一至四本功法典籍，静心参悟。典籍越多，领悟越有把握；放满四本，必能悟得一门功法。品质越高，越有机会领悟高深功法。
            </p>
            <p>
              参悟会消耗所选典籍、天地灵气与道心感悟，即使未有所悟也不返还。所得功法会凝录为玉简收入储物袋，达到相应境界后即可修习。
            </p>
          </div>
        </details>
        <InkDetailDrawer
          isOpen={drawer === 'bag'}
          title="选择功法典籍"
          onClose={() => setDrawer(undefined)}
          size="md"
          footer={
            <InkButton onClick={() => setDrawer(undefined)}>选好了</InkButton>
          }
        >
          <MaterialPicker session={session} />
        </InkDetailDrawer>
        <InkModal
          isOpen={drawer === 'confirm'}
          title="确认参悟"
          onClose={() => setDrawer(undefined)}
          footer={
            <div className="flex justify-end gap-3">
              <InkButton onClick={() => setDrawer(undefined)}>取消</InkButton>
              <InkButton
                disabled={session.locked || !!session.problem}
                onClick={() => {
                  setDrawer(undefined);
                  void session.submit();
                }}
              >
                确认参悟
              </InkButton>
            </div>
          }
        >
          <div className="space-y-4 text-sm">
            {Array.from(session.quantities, ([id, quantity]) => (
              <p key={id}>
                {session.byId.get(id)?.name} ×
                <span className="font-mono">{quantity}</span>
              </p>
            ))}
            <Probabilities session={session} />
            {session.preview ? (
              <div className="space-y-1">
                <p>
                  天地灵气{' '}
                  <span className="font-mono">{session.preview.cost.qi}</span>
                </p>
                <p>
                  道心感悟{' '}
                  <span className="font-mono">
                    {session.preview.cost.insight}
                  </span>
                </p>
              </div>
            ) : null}
            <p className="text-crimson">
              本次典籍及费用均会消耗，未能悟得功法也不返还。
            </p>
            {session.problem ? <p role="alert">{session.problem}</p> : null}
          </div>
        </InkModal>
      </div>
    </GameSceneFrame>
  );
}
