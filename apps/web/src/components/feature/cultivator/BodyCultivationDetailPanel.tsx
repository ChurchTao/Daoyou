import { PillQuickbar } from '@app/components/feature/items/PillQuickbar';
import { GameSceneLoading } from '@app/components/game-shell/GameSceneFrame';
import { InkNotice } from '@app/components/ui';
import { GameImage } from '@app/components/ui/GameImage';
import { cn } from '@app/lib/cn';
import {
  useCultivatorCondition,
  useCultivatorIdentity,
} from '@app/lib/resources/player';
import { DaoyouRule } from '@daoyou/game-content/combat/tuning';
import type { BodyCultivationTrackPath } from '@daoyou/game-domain/condition';
import {
  bodyCultivationEffectValues,
  getBodyCultivationSummary,
  type BodyCultivationTrackSummary,
} from '@daoyou/game-rules/body-cultivation/progress';
import { getMarrowWashSummary } from '@daoyou/game-rules/body-cultivation/training';
import { useState } from 'react';
import { MarrowWashPanel } from './MarrowWashPanel';

const trackPositions = [
  'col-start-1 row-start-1',
  'col-start-1 row-start-2',
  'col-start-3 row-start-2',
  'col-start-1 row-start-3',
  'col-start-3 row-start-1',
];
const number = (value: number) => Number(value.toFixed(1));

function TrackEffects({ track }: { track: BodyCultivationTrackSummary }) {
  const effect = bodyCultivationEffectValues(track.key, track.level);
  const reducing = track.key === 'skin' || track.key === 'primordial_spirit';
  const physical = track.key === 'skin' || track.key === 'sinew_bone';
  const primary =
    effect.kind === 'life'
      ? { label: '基础气血', value: `+${number(effect.hpPercent)}` }
      : {
          label: `${physical ? '物理' : '法术'}${reducing ? '减伤' : '增伤'}`,
          value: number(effect.damagePercent),
        };
  const secondary =
    effect.kind === 'life'
      ? [{ label: '固定治疗强度', value: `+${effect.healPower}` }]
      : [
          {
            label: `固定${reducing ? '减伤' : '增伤'}`,
            value: effect.damageFlat,
          },
          ...(effect.sealBasePercent === null
            ? []
            : [
                {
                  label: reducing ? '受封印命中基值' : '封印命中基值',
                  value: `${reducing ? '−' : '+'}${number(effect.sealBasePercent)}%`,
                },
              ]),
        ];
  return (
    <div aria-label="当前修炼效果">
      <dl>
        <dt className="text-ink-secondary text-sm">{primary.label}</dt>
        <dd className="mt-1 font-mono text-5xl leading-tight font-semibold tracking-tight lg:text-6xl">
          {primary.value}
          <span className="ml-1 text-2xl">%</span>
        </dd>
      </dl>
      <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
        {secondary.map((stat) => (
          <div key={stat.label}>
            <dt className="text-ink-secondary text-xs">{stat.label}</dt>
            <dd className="mt-1 font-mono text-lg font-semibold">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
      {effect.kind === 'training' ? (
        <p className="text-ink-secondary mt-3 text-xs">
          对手修炼为 <span className="font-mono">0</span> 时
        </p>
      ) : null}
    </div>
  );
}

export function BodyCultivationDetailPanel() {
  const profile = useCultivatorIdentity();
  const condition = useCultivatorCondition();
  const identity = profile.data?.cultivator;
  const [selected, setSelected] = useState<
    BodyCultivationTrackPath | 'marrow_wash'
  >('body.skin');
  const [pending, setPending] = useState(false);
  if (profile.error || condition.error)
    return <InkNotice>{profile.error || condition.error}</InkNotice>;
  if ((!identity || !condition.data) && (profile.loading || condition.loading))
    return <GameSceneLoading message="正在读取修炼进度……" />;
  if (!identity || !condition.data)
    return <InkNotice>尚无角色资料。</InkNotice>;
  const summary = getBodyCultivationSummary(condition.data, {
    cultivatorRealm: identity.realm,
  });
  const track = summary.tracks.find((candidate) => candidate.path === selected);
  const marrow = getMarrowWashSummary(condition.data, {
    cultivatorRealm: identity.realm,
  });
  const current = track ?? marrow;
  const cap = track ? summary.trackLevelCap : marrow.levelCap;
  const capped = current.level >= cap;
  const percent = capped
    ? 100
    : Math.round(Math.min(current.progress / current.threshold, 1) * 100);
  const gender = identity.gender === '女' ? 'female' : 'male';
  const portrait = track
    ? `/assets/body-cultivation/cultivator-${gender}-cauldron.webp`
    : `/assets/manuals/cultivator-${gender}-meditation.webp`;

  return (
    <div
      aria-busy={pending}
      className="grid gap-5 text-sm leading-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-7"
    >
      <section aria-label="肉身修炼方向" className="min-w-0">
        <div className="mb-2 flex items-baseline gap-3 lg:mb-4">
          <span className="text-base font-semibold">{summary.realm.label}</span>
          <span className="text-ink-secondary text-xs">
            总 <span className="font-mono">Lv.{summary.totalLevel}</span>
          </span>
        </div>
        <div
          role="group"
          aria-label="选择修炼方向"
          className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] grid-rows-3 items-center gap-x-2 gap-y-3 lg:grid-cols-[3.75rem_minmax(0,1fr)_3.75rem]"
        >
          <GameImage
            src={portrait}
            alt={`${identity.name}${track ? '举鼎炼体' : '静坐洗髓'}`}
            width={track ? 640 : 960}
            height={960}
            draggable={false}
            className="pointer-events-none col-start-2 row-span-3 row-start-1 h-56 w-full object-contain select-none sm:h-72 lg:h-[25rem]"
          />
          {summary.tracks.map((candidate, index) => (
            <button
              key={candidate.path}
              type="button"
              disabled={pending}
              aria-pressed={selected === candidate.path}
              aria-controls="body-training-detail"
              onClick={() => setSelected(candidate.path)}
              className={cn(
                'min-h-16 px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
                trackPositions[index],
                selected === candidate.path
                  ? 'text-crimson bg-crimson/5'
                  : 'text-ink-secondary hover:bg-ink/3',
              )}
            >
              <span
                className={cn(
                  'inline-block border-b pb-1 text-sm',
                  selected === candidate.path
                    ? 'border-crimson font-semibold'
                    : 'border-ink/20',
                )}
              >
                {candidate.name.replace('炼体·', '')}
              </span>
              <span className="mt-1 block font-mono text-xs">
                Lv.{candidate.level}
              </span>
            </button>
          ))}
          <button
            type="button"
            disabled={pending}
            aria-pressed={selected === 'marrow_wash'}
            aria-controls="body-training-detail"
            onClick={() => setSelected('marrow_wash')}
            className={cn(
              'col-start-3 row-start-3 min-h-16 px-1 py-2 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50',
              selected === 'marrow_wash'
                ? 'text-crimson bg-crimson/5'
                : 'text-ink-secondary hover:bg-ink/3',
            )}
          >
            <span
              className={cn(
                'inline-block border-b pb-1 text-sm',
                selected === 'marrow_wash'
                  ? 'border-crimson font-semibold'
                  : 'border-ink/20',
              )}
            >
              洗髓
            </span>
            <span className="mt-1 block font-mono text-xs">
              Lv.{marrow.level}
            </span>
          </button>
        </div>
      </section>
      <section
        id="body-training-detail"
        aria-label={track ? `${track.name}修炼进度` : '洗髓修炼进度'}
        className="lg:border-ink/15 min-w-0 lg:border-l lg:pl-7"
      >
        <div className="mb-5 flex items-baseline justify-between gap-3">
          <h3 className="text-base font-semibold">
            {track ? track.name.replace('炼体·', '') : '洗髓'}
          </h3>
          <span className="text-ink-secondary font-mono text-xs">
            Lv.{current.level} / {cap}
          </span>
        </div>
        {track ? <TrackEffects track={track} /> : <MarrowWashPanel />}
        <div className="mt-6">
          <div className="text-ink-secondary mb-1 flex justify-between gap-2 text-xs">
            <span>{capped ? `${identity.realm}上限` : '进度'}</span>
            {!capped ? (
              <span className="font-mono">
                {current.progress} / {current.threshold}
              </span>
            ) : null}
          </div>
          <div
            role="progressbar"
            aria-label={track ? '修炼进度' : '洗髓进度'}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="bg-ink/10 h-1.5 overflow-hidden"
          >
            <div
              className={cn(
                'h-full transition-all',
                track ? 'bg-crimson/80' : 'bg-teal',
              )}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
        <div className="mt-5">
          <PillQuickbar
            key={selected}
            trainingTrack={selected}
            disabled={pending || capped}
            onPendingChange={setPending}
          />
        </div>
        <details className="text-ink-secondary mt-4 text-xs">
          <summary className="min-h-9 cursor-pointer content-center focus-visible:outline-2 focus-visible:outline-offset-2">
            效果说明
          </summary>
          <div className="mt-1 space-y-2 leading-6">
            {track ? (
              track.key === 'qi_blood' ? (
                <p>
                  气血加成以裸身气血为基数；固定治疗强度提高施放治疗的恢复量。
                </p>
              ) : (
                <>
                  <p>
                    伤害修正取双方对应修炼的等级差，差值范围为{' '}
                    <span className="font-mono">
                      {DaoyouRule.damageCultivateDiffMin} 至{' '}
                      {DaoyouRule.damageCultivateDiffMax}
                    </span>
                    。固定伤害不受影响，结算伤害最低为{' '}
                    <span className="font-mono">{DaoyouRule.minDamage}</span>。
                  </p>
                  {track.key === 'organs' ||
                  track.key === 'primordial_spirit' ? (
                    <p>封印修炼差先修正命中基值，再按命中上下限折算。</p>
                  ) : null}
                </>
              )
            ) : (
              <p>
                洗髓每级获得 <span className="font-mono">1</span>{' '}
                个自由属性点，每 <span className="font-mono">10</span> 级获得{' '}
                <span className="font-mono">1</span> 点灵根后天强度。
              </p>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
