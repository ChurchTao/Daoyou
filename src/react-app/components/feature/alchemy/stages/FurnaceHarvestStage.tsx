import {
  getPillFamilyLabel,
  PillAppearanceMark,
  PillKeywordLine,
  toPillDisplayModel,
} from '@app/components/feature/consumables';
import { InkBadge, InkButton, InkNotice } from '@app/components/ui';
import { isPillConsumable } from '@shared/lib/consumables';
import { getPillAppearanceLabel } from '@shared/lib/pillAppearance';
import type { AlchemyYieldDisplayProfile } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import { useAlchemyCraftSession } from '../alchemyCraftContext';

export function FurnaceHarvestStage({ onReturn }: { onReturn(): void }) {
  const session = useAlchemyCraftSession();
  const items = session.result.craftedConsumables;
  const total = items.reduce((sum, item) => sum + item.quantity, 0);
  const profile = session.result.yieldProfile;

  return (
    <div className="space-y-6">
      <header className="border-wood/30 border bg-[radial-gradient(circle_at_50%_0%,rgba(136,97,45,0.14),transparent_55%)] px-5 py-8 text-center">
        <p className="text-wood text-xs tracking-[0.3em]">
          炼制完成
        </p>
        <div className="mt-5 grid grid-cols-3 divide-x divide-[rgba(136,97,45,0.22)]">
          <ResultCount label="成丹总数" value={`${total} 枚`} />
          <ResultCount label="丹品批次" value={`${items.length} 批`} />
          <ResultCount
            label="主丹品阶"
            value={profile?.primaryQuality ?? items[0]?.quality ?? '未定'}
          />
        </div>
      </header>

      {items.length ? (
        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div>
              <p className="text-crimson text-xs tracking-[0.22em]">
                成丹清单
              </p>
              <h3 className="mt-1 text-lg">本炉所得，一览于此</h3>
            </div>
            <p className="text-ink-secondary text-xs">
              共 {items.length} 批，合计 {total} 枚
            </p>
          </div>
          <div className="space-y-3">
            {items.map((item, index) => (
              <PillBatchLedger
                key={`${item.id ?? item.name}-${index}`}
                item={item}
                index={index}
                primary={index === 0}
              />
            ))}
          </div>
        </section>
      ) : (
        <InkNotice tone="warning">炉中结果尚未落定。</InkNotice>
      )}

      {profile ? <YieldSummary profile={profile} /> : null}

      {session.result.formulaProgress ? (
        <InkNotice tone="info">
          丹方熟练 +{session.result.formulaProgress.gainedExp}，当前 Lv.
          {session.result.formulaProgress.level}。
        </InkNotice>
      ) : null}

      {session.result.formulaDiscovery ? (
        <section className="border-crimson/30 border border-dashed p-5">
          <p className="text-crimson text-xs tracking-[0.24em]">发现新丹方</p>
          <h3 className="mt-2 text-lg">
            {session.result.formulaDiscovery.name}
          </h3>
          <p className="text-ink-secondary mt-2 text-sm leading-7">
            {session.result.formulaDiscovery.description}
          </p>
          <p className="text-ink-secondary mt-2 text-xs">
            {session.result.formulaDiscovery.discoveryRemark}
          </p>
          <p className="text-ink-secondary mt-2 text-xs leading-6">
            保存后，今后便可按照这份丹方推演材料并重复炼制。
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <InkButton
              variant="secondary"
              onClick={() => void session.resolveDiscovery(false)}
            >
              不保存
            </InkButton>
            <InkButton
              variant="primary"
              onClick={() => void session.resolveDiscovery(true)}
            >
              保存到丹方玉简
            </InkButton>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <InkButton
          variant="secondary"
          onClick={() => {
            session.startNextBatch();
            onReturn();
          }}
        >
          返回炼丹房
        </InkButton>
        <InkButton variant="primary" onClick={session.startNextBatch}>
          再炼一炉
        </InkButton>
      </div>
    </div>
  );
}

function ResultCount({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 px-2">
      <p className="text-ink-secondary text-[0.68rem] sm:text-xs">{label}</p>
      <p className="text-wood mt-2 truncate text-lg font-semibold sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function PillBatchLedger({
  item,
  index,
  primary,
}: {
  item: Consumable;
  index: number;
  primary: boolean;
}) {
  const pill = isPillConsumable(item) ? item : null;
  const model = pill ? toPillDisplayModel(pill) : null;
  const appearance = pill?.spec.alchemyMeta.appearance;

  return (
    <article
      className={`border ${
        primary
          ? 'border-wood/40 bg-wood/[0.07]'
          : 'border-ink/15 bg-bgpaper/45'
      }`}
    >
      <div className="grid gap-4 p-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-start">
        <div
          className={`grid size-11 place-items-center rounded-full border text-sm ${
            primary
              ? 'border-wood/40 text-wood'
              : 'border-ink/20 text-ink-secondary'
          }`}
        >
          {primary ? '主' : `副${index}`}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              className={`relative inline-flex max-w-full items-baseline text-base font-semibold ${appearance ? 'pr-7' : ''}`}
            >
              <span className="truncate">{item.name}</span>
              {model?.appearance ? (
                <span className="absolute -top-2 right-0">
                  <PillAppearanceMark
                    appearance={model.appearance}
                    className="text-[0.68rem]"
                  />
                </span>
              ) : null}
            </h4>
            {pill ? (
              <InkBadge>{getPillFamilyLabel(pill.spec.family)}</InkBadge>
            ) : null}
            {item.quality ? (
              <InkBadge
                tier={item.quality}
                hideTierText
                className="px-0"
              >
                {item.quality}
              </InkBadge>
            ) : null}
          </div>

          {model ? (
            <div className="mt-3 space-y-2">
              <p className="text-sm leading-6">
                <span className="text-ink-secondary">主要药效：</span>
                {model.primaryEffect}
              </p>
              <PillKeywordLine labels={model.keywordLabels} />
              {model.flavorText ? (
                <p className="text-ink-secondary border-ink/10 border-t border-dashed pt-2 text-xs leading-6">
                  {model.flavorText}
                </p>
              ) : null}
            </div>
          ) : item.description ? (
            <p className="text-ink-secondary mt-3 text-xs leading-6">
              {item.description}
            </p>
          ) : null}
        </div>

        <div className="border-ink/10 flex items-baseline justify-between border-t pt-3 sm:block sm:border-t-0 sm:pt-0 sm:text-right">
          <span className="text-ink-secondary text-xs">本批所得</span>
          <strong className={`ml-2 text-2xl ${primary ? 'text-wood' : ''}`}>
            ×{item.quantity}
          </strong>
        </div>
      </div>
    </article>
  );
}

function YieldSummary({ profile }: { profile: AlchemyYieldDisplayProfile }) {
  return (
    <section className="border-ink/15 grid gap-0 border sm:grid-cols-2 sm:divide-x sm:divide-[rgba(58,50,43,0.1)]">
      <ResultMetric
        label="药蕴损耗"
        value={`${Math.round(profile.essenceLossRatio * 100)}%`}
      />
      <ResultMetric
        label="各品相所得"
        value={profile.lots
          .map(
            (lot) =>
              `${lot.quality}·${getPillAppearanceLabel(lot.appearance)} ×${lot.quantity}`,
          )
          .join('、')}
      />
    </section>
  );
}

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4">
      <p className="text-ink-secondary text-xs tracking-[0.14em]">{label}</p>
      <p className="mt-2 text-sm leading-6">{value}</p>
    </div>
  );
}
