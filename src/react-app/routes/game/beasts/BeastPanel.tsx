import { AttributeAllocation } from '@app/components/feature/attributes/AttributeAllocation';
import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastMutationTag } from '@app/components/feature/beasts/BeastMutationTag';
import { BeastSkillGrid } from '@app/components/feature/beasts/BeastSkillGrid';
import { InkModal } from '@app/components/layout/InkModal';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTag } from '@app/components/ui/InkTag';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { getLevelRealmStage } from '@shared/config/realmProgression';
import {
  BEAST_SPECIES,
  beastPanel,
  canDeployBeast,
  type SummonedBeast,
} from '@shared/engine/combat-v6/beasts';
import { BEAST_PROGRESSION } from '@shared/engine/combat-v6/beasts/content';
import {
  allocateBeast,
  BEAST_ATTRIBUTE_NAMES,
  nextBeastExp,
} from '@shared/engine/combat-v6/beasts/progression';
import { beastAttributes } from '@shared/engine/combat-v6/beasts/projection';
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
    <div className="min-w-0 space-y-5">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-6">
        <div className="from-teal/10 before:border-teal/15 relative flex aspect-square items-center justify-center bg-radial to-transparent before:absolute before:inset-1 before:rounded-full before:border sm:before:inset-3">
          <span aria-hidden className="font-sans text-5xl sm:text-7xl">
            <BeastIcon speciesId={beast.speciesId} isMutant={beast.isMutant} />
          </span>
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="truncate text-xl" title={beast.name}>
              {beast.name}
            </h2>
            {isLead ? <BeastLeadSeal /> : null}
            {beast.isMutant ? (
              <BeastMutationTag isMutant />
            ) : (
              <InkTag className="shrink-0 text-xs">
                {beast.originKind === 'wild'
                  ? '成年'
                  : beast.originKind === 'pseudo_baby'
                    ? '假幼崽'
                    : '幼崽'}
              </InkTag>
            )}
            <InkButton variant="ghost" disabled={pending} onClick={rename}>
              改名
            </InkButton>
          </div>
          {definition && definition.name !== beast.name ? (
            <p className="text-ink-secondary text-xs">
              物种 · {definition.name}
            </p>
          ) : null}
          <p className="text-ink-secondary text-xs leading-6">
            等级{' '}
            <span className="font-mono">{beast.level}</span> · 携带要求{' '}
            {definition ? getLevelRealmStage(definition.carryLevel).label : '—'}
          </p>
          {beast.originKind === 'wild' && (
            <p className="text-ink-secondary text-xs">
              初始{beast.initialLevel}级，较同级幼崽少
              {50 + 2 * beast.initialLevel}属性点
            </p>
          )}
          <div className="text-ink-secondary flex flex-wrap items-center gap-x-3 text-xs">
            <span>
              成长 <span className="font-mono">{beast.growth.toFixed(3)}</span>
            </span>
            <span>
              寿命{' '}
              <span className="font-mono">
                {beast.currentLifespan} / {beast.maxLifespan}
              </span>
            </span>
            <InkTooltip label="寿命与入场规则">
              每场满气血、法力入场。野外死亡每场扣除一次
              {BEAST_PROGRESSION.lifespan.deathLoss}寿命；不足
              {BEAST_PROGRESSION.lifespan.deployMinimum}
              不能出战，切磋与练功不消耗寿命。
            </InkTooltip>
          </div>
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
        <div className="col-span-2 flex flex-wrap gap-2 sm:col-start-2">
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
          <div className="flex items-center gap-2">
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
