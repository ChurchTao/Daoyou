import { AttributeAllocation } from '@app/components/feature/attributes/AttributeAllocation';
import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastMutationTag } from '@app/components/feature/beasts/BeastMutationTag';
import { BeastSkillGrid } from '@app/components/feature/beasts/BeastSkillGrid';
import { InkModal } from '@app/components/layout/InkModal';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTag } from '@app/components/ui/InkTag';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import { BEAST_SPECIES, BEAST_PROGRESSION } from '@daoyou/game-content/beasts';
import {
  beastPanel,
  canDeployBeast,
  beastAttributes,
} from '@daoyou/game-rules/beasts/projection';
import { type SummonedBeast } from '@daoyou/game-domain/beasts';
import {
  allocateBeast,
  BEAST_ATTRIBUTE_NAMES,
  nextBeastExp,
} from '@daoyou/game-rules/beasts/growth';
import { useState } from 'react';
import type { BeastAction } from './BeastActionDrawer';

const species = new Map(BEAST_SPECIES.map((s) => [s.id as string, s]));

export function BeastLeadSeal() {
  return (
    <InkBadge tone="accent" compact className="shrink-0">
      首发
    </InkBadge>
  );
}
function Stat({
  label,
  value,
  before,
}: {
  label: string;
  value: number;
  before?: number;
}) {
  return (
    <div className="border-ink/8 flex flex-wrap items-center justify-between gap-x-3 border-b py-1.5">
      <dt className="text-ink-secondary text-xs">{label}</dt>
      <dd className="ml-auto font-mono text-sm">
        {before !== undefined && before !== value ? (
          <span className="text-ink-secondary mr-1 text-xs">
            {before.toLocaleString()} →
          </span>
        ) : null}
        {value.toLocaleString()}
      </dd>
    </div>
  );
}
export function BeastPanel({
  beast,
  ownerLevel,
  isLead,
  carried,
  full,
  pending,
  pendingLineup,
  lineup,
  act,
  learn,
  refine,
  rejuvenate,
  feed,
  rename,
  allocate,
}: {
  beast: SummonedBeast;
  ownerLevel: number;
  isLead: boolean;
  carried: boolean;
  full: boolean;
  pending: boolean;
  pendingLineup?: 'carry' | 'lead' | 'unlead';
  lineup: (action: 'carry' | 'lead' | 'unlead') => void;
  act: (action: BeastAction) => void;
  learn: () => void;
  refine: () => void;
  rejuvenate: () => void;
  feed: () => void;
  rename: () => void;
  allocate: (points: SummonedBeast['allocatedAttributes']) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<SummonedBeast['allocatedAttributes']>({
    constitution: 0,
    strength: 0,
    magic: 0,
    endurance: 0,
    agility: 0,
  });
  const [confirming, setConfirming] = useState(false);
  const total = Object.values(draft).reduce((sum, value) => sum + value, 0);
  const before = beastPanel(beast);
  const attributes = beastAttributes(beast);
  const canAllocate = beast.level <= ownerLevel;
  const panel =
    total > 0 && canAllocate
      ? beastPanel(allocateBeast(beast, draft, ownerLevel))
      : before;
  const definition = species.get(beast.speciesId);
  const capped = beast.level >= Math.min(ownerLevel, 180);
  const exp = nextBeastExp(beast.level);
  const reason =
    !definition || definition.carryLevel > ownerLevel
      ? '人物境界未达到携带要求'
      : beast.level > ownerLevel
        ? '灵兽等级超过人物等级上限'
        : beast.currentLifespan < BEAST_PROGRESSION.lifespan.deployMinimum
          ? '寿命不足，请先休养'
          : undefined;
  return (
    <div className="@container min-w-0 space-y-5">
      <div className="grid grid-cols-[96px_minmax(0,1fr)] items-start gap-x-3 gap-y-2 @min-[30rem]:grid-cols-[128px_minmax(0,1fr)] @min-[30rem]:gap-x-5 @min-[38rem]:grid-cols-[160px_minmax(0,1fr)]">
        <div className="row-span-2 flex flex-col items-center justify-center gap-1 @min-[30rem]:row-span-1">
          <BeastIcon
            speciesId={beast.speciesId}
            isMutant={beast.isMutant}
            className="text-[96px] @min-[30rem]:text-[128px] @min-[38rem]:text-[160px]"
          />
          {isLead ? <BeastLeadSeal /> : null}
        </div>
        <div className="contents min-w-0 @min-[30rem]:block">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1">
              <h2
                className="min-w-0 truncate text-lg @min-[30rem]:text-xl"
                title={beast.name}
              >
                {beast.name}
              </h2>
              {beast.isMutant ? (
                <BeastMutationTag isMutant />
              ) : (
                <InkTag className="shrink-0 text-xs">
                  {beast.originKind === 'wild'
                    ? '野生'
                    : beast.originKind === 'pseudo_baby'
                      ? '野生'
                      : '幼崽'}
                </InkTag>
              )}
              <InkButton
                variant="ghost"
                className="shrink-0 px-0 text-sm tracking-normal"
                disabled={pending}
                onClick={rename}
              >
                改名
              </InkButton>
            </div>
            <div className="text-ink-secondary flex items-center gap-1 text-xs leading-6 whitespace-nowrap">
              <span className="min-w-0 truncate" title={definition?.name}>
                {definition?.name ?? '—'}
              </span>
              <span aria-hidden>·</span>
              <span className="shrink-0">
                <span className="font-mono">{beast.level}</span>级
              </span>
              <span aria-hidden>·</span>
              <span className="shrink-0" title="携带要求">
                需
                {definition
                  ? getLevelRealmStage(definition.carryLevel).label
                  : '—'}
              </span>
            </div>
          </div>
          <div className="col-start-2 min-w-0 @min-[30rem]:mt-2">
            <div
              className="bg-ink/10 mt-2 h-1 overflow-hidden"
              role="progressbar"
              aria-label="升级修为"
              aria-valuemin={0}
              aria-valuemax={exp}
              aria-valuenow={Math.min(beast.exp, exp)}
            >
              <div
                className="bg-teal h-full"
                style={{ width: `${Math.min(100, (beast.exp / exp) * 100)}%` }}
              />
            </div>
            <div className="text-ink-secondary mt-1 flex flex-wrap justify-between gap-x-2 text-xs">
              <span>{capped ? '已达当前培养上限' : '修为'}</span>
              <span className="font-mono">
                {beast.exp.toLocaleString()} / {exp.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-x-2 gap-y-1 @min-[30rem]:mt-2 @min-[44rem]:flex @min-[44rem]:flex-wrap">
            <div className="flex items-center">
              <InkButton
                variant={isLead ? 'secondary' : 'primary'}
                pending={
                  pending &&
                  (pendingLineup === 'lead' || pendingLineup === 'unlead')
                }
                disabled={
                  pending ||
                  (!isLead &&
                    (!canDeployBeast(beast, ownerLevel) || (!carried && full)))
                }
                onClick={() => lineup(isLead ? 'unlead' : 'lead')}
              >
                {isLead ? '取消首发' : '设为首发'}
              </InkButton>
              {!isLead && (reason || (!carried && full)) ? (
                <InkTooltip label="设为首发条件">
                  {reason ?? '携带灵兽已满（最多6只）'}
                </InkTooltip>
              ) : null}
            </div>
            <div className="flex items-center">
              <InkButton
                variant={carried ? 'secondary' : 'default'}
                pending={pending && pendingLineup === 'carry'}
                disabled={pending || (!carried && full)}
                onClick={() => lineup('carry')}
              >
                {carried ? '取消携带' : '携带出战'}
              </InkButton>
              {!carried && full ? (
                <InkTooltip label="携带出战条件">
                  携带灵兽已满（最多6只）。
                </InkTooltip>
              ) : null}
            </div>
            <div className="flex items-center">
              <InkButton disabled={pending || capped} onClick={feed}>
                喂养
              </InkButton>
              {capped ? (
                <InkTooltip label="喂养条件">已达当前培养上限。</InkTooltip>
              ) : null}
            </div>
            <div className="flex items-center">
              <InkButton
                disabled={pending || beast.currentLifespan >= beast.maxLifespan}
                onClick={() => act('rest')}
              >
                休养
              </InkButton>
              {beast.currentLifespan >= beast.maxLifespan ? (
                <InkTooltip label="休养条件">寿命已满。</InkTooltip>
              ) : null}
            </div>
          </div>
        </div>
      </div>
      <div className="border-ink/15 grid gap-5 border-t pt-4 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
        <section>
          <h3 className="text-teal mb-2 text-sm">战斗属性</h3>
          <dl className="grid grid-cols-2 gap-x-5">
            {(
              [
                ['maxHp', '气血'],
                ['maxMp', '法力'],
                ['physicalAtk', '物攻'],
                ['physicalDef', '物防'],
                ['magicAtk', '法攻'],
                ['magicDef', '法防'],
                ['speed', '速度'],
              ] as const
            ).map(([key, label]) => (
              <Stat
                key={key}
                label={label}
                value={panel[key]}
                before={before[key]}
              />
            ))}
          </dl>
        </section>
        <section>
          <h3 className="text-teal mb-2 text-sm">资质</h3>
          <dl className="grid grid-cols-2 gap-x-5 lg:grid-cols-1">
            {(
              [
                ['attack', '攻击资质'],
                ['defense', '防御资质'],
                ['health', '体力资质'],
                ['mana', '法力资质'],
                ['speed', '速度资质'],
              ] as const
            ).map(([key, label]) => (
              <Stat key={key} label={label} value={beast.aptitudes[key]} />
            ))}
            <div className="border-ink/8 flex flex-wrap items-center justify-between gap-x-3 border-b py-1.5">
              <dt className="text-ink-secondary text-xs">成长</dt>
              <dd className="ml-auto font-mono text-sm">
                {beast.growth.toFixed(3)}
              </dd>
            </div>
            <div className="border-ink/8 col-span-2 flex flex-wrap items-center justify-between gap-x-3 border-b py-1.5 lg:col-span-1">
              <dt className="text-ink-secondary text-xs">寿命</dt>
              <dd className="ml-auto font-mono text-sm">
                <InkTooltip
                  label={`寿命 ${beast.currentLifespan}/${beast.maxLifespan}，查看寿命与入场规则`}
                  triggerClassName="text-ink hover:text-ink-secondary focus-visible:outline-ink inline-flex h-6 shrink-0 cursor-help items-center whitespace-nowrap underline decoration-dotted underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2"
                  triggerContent={`${beast.currentLifespan}/${beast.maxLifespan}`}
                >
                  每场满气血、法力入场。野外死亡每场扣除一次
                  {BEAST_PROGRESSION.lifespan.deathLoss}寿命；不足
                  {BEAST_PROGRESSION.lifespan.deployMinimum}
                  不能出战，切磋与练功不消耗寿命。
                </InkTooltip>
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <AttributeAllocation
        attributes={Object.entries(BEAST_ATTRIBUTE_NAMES).map(
          ([id, label]) => ({
            id: id as keyof typeof draft,
            label,
            value: attributes[id as keyof typeof draft],
          }),
        )}
        available={beast.unallocatedPoints}
        draft={draft}
        onChange={setDraft}
        disabled={pending || !canAllocate || confirming}
        onConfirm={() => setConfirming(true)}
        headerAction={
          <InkButton disabled={pending} onClick={rejuvenate}>
            洗点
          </InkButton>
        }
      />
      <InkModal
        isOpen={confirming}
        onClose={() => {
          if (!pending) setConfirming(false);
        }}
        title={`确认分配 · ${beast.name}`}
        footer={
          <div className="flex justify-end gap-3">
            <InkButton
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              返回调整
            </InkButton>
            <InkButton
              variant="primary"
              pending={pending}
              disabled={total === 0 || !canAllocate}
              onClick={async () => {
                if (await allocate(draft)) setConfirming(false);
              }}
            >
              确认分配
            </InkButton>
          </div>
        }
      >
        <p className="text-sm">
          消耗 <span className="font-mono">{total}</span> 点，确认后不可撤销。
        </p>
        <dl className="mt-3 space-y-2">
          {Object.entries(BEAST_ATTRIBUTE_NAMES)
            .filter(([id]) => draft[id as keyof typeof draft] > 0)
            .map(([id, label]) => (
              <div key={id} className="flex justify-between text-sm">
                <dt>{label}</dt>
                <dd className="text-teal font-mono">
                  +{draft[id as keyof typeof draft]}
                </dd>
              </div>
            ))}
        </dl>
      </InkModal>
      <section className="border-ink/15 border-t pt-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-teal text-sm">技能</h3>
          <div className="flex flex-wrap items-center gap-2">
            <InkButton disabled={pending} onClick={learn}>
              领悟传承
            </InkButton>
            <InkButton disabled={pending} onClick={refine}>
              洗炼
            </InkButton>
          </div>
        </div>
        <BeastSkillGrid skills={beast.skills} />
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={
            reason ? 'text-crimson text-xs' : 'text-ink-secondary text-xs'
          }
        >
          {reason ?? (full && !carried ? '携带灵兽已满（最多6只）' : '可出战')}
        </span>
        <div className="flex items-center gap-1">
          <InkButton
            disabled={pending || isLead}
            onClick={() => act('release')}
          >
            放生
          </InkButton>
          {isLead ? (
            <InkTooltip label="放生条件">放生前请先取消首发。</InkTooltip>
          ) : null}
        </div>
      </div>
    </div>
  );
}
