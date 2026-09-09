import { AttributeAllocation } from '@app/components/feature/attributes/AttributeAllocation';
import { InkModal } from '@app/components/layout/InkModal';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { combatV6SkillDetails } from '@shared/combat-v6/skill-details';
import {
  activeBeastSkills,
  BEAST_SKILLS,
  BEAST_SPECIES,
  beastPanel,
  canDeployBeast,
  type SummonedBeast,
} from '@shared/engine/combat-v6/beasts';
import {
  allocateBeast,
  BEAST_ATTRIBUTE_NAMES,
  nextBeastExp,
} from '@shared/engine/combat-v6/beasts/progression';
import { useState } from 'react';
import type { BeastAction } from './BeastActionDrawer';

const species = new Map(BEAST_SPECIES.map((s) => [s.id as string, s]));
const skills = new Map(BEAST_SKILLS.map((s) => [s.id, s]));
const descriptions = combatV6SkillDetails(BEAST_SKILLS, []);
export function BeastIcon({ speciesId }: { speciesId: string }) {
  return (
    (
      {
        'combat.wild.species.spirit-fox': '🦊',
        'combat.wild.species.rock-boar': '🐗',
        'combat.wild.species.wind-wolf': '🐺',
      } as Record<string, string>
    )[speciesId] ?? '🐾'
  );
}
export function BeastLeadSeal() {
  return (
    <span className="border-crimson/60 text-crimson shrink-0 rounded-xs border px-1 text-[0.65rem] leading-4">
      首发
    </span>
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
  lineup,
  act,
  learn,
  allocate,
}: {
  beast: SummonedBeast;
  ownerLevel: number;
  isLead: boolean;
  carried: boolean;
  full: boolean;
  pending: boolean;
  lineup: (action: 'carry' | 'lead' | 'unlead') => void;
  act: (action: BeastAction) => void;
  learn: () => void;
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
  const canAllocate = beast.level <= ownerLevel;
  const panel =
    total > 0 && canAllocate
      ? beastPanel(allocateBeast(beast, draft, ownerLevel))
      : before;
  const definition = species.get(beast.speciesId);
  const active = new Set(activeBeastSkills(beast));
  const capped = beast.level >= Math.min(ownerLevel, 180);
  const exp = nextBeastExp(beast.level);
  const reason =
    !definition || definition.carryLevel > ownerLevel
      ? '人物等级未达到携带要求'
      : beast.level > ownerLevel
        ? '战斗等级超过人物等级'
        : beast.currentLifespan < 50
          ? '寿命不足，请先休养'
          : undefined;
  return (
    <div className="min-w-0 space-y-5">
      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[130px_minmax(0,1fr)] sm:gap-6">
        <div className="from-teal/10 before:border-teal/15 relative flex aspect-square items-center justify-center bg-radial to-transparent before:absolute before:inset-1 before:rounded-full before:border sm:before:inset-3">
          <span aria-hidden className="font-sans text-5xl sm:text-7xl">
            <BeastIcon speciesId={beast.speciesId} />
          </span>
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <h2 className="truncate text-xl" title={beast.name}>
              {beast.name}
            </h2>
            {isLead ? <BeastLeadSeal /> : null}
          </div>
          <p className="text-ink-secondary text-xs leading-6">
            战斗等级 {beast.level} · 携带等级 {definition?.carryLevel ?? '—'}
          </p>
          <div className="text-ink-secondary flex flex-wrap items-center gap-x-3 text-xs">
            <span>成长 {beast.growth.toFixed(3)}</span>
            <span>
              寿命 {beast.currentLifespan} / {beast.maxLifespan}
            </span>
            <InkTooltip label="寿命与入场规则">
              每场满气血、法力入场。野外死亡每场扣除一次50寿命；不足50不能出战，切磋与练功不消耗寿命。
            </InkTooltip>
          </div>
          <div
            className="bg-ink/10 mt-2 h-1 overflow-hidden"
            role="progressbar"
            aria-label="升级经验"
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
            <span>{capped ? '已达当前培养上限' : '经验'}</span>
            <span>
              {beast.exp.toLocaleString()} / {exp.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="col-span-2 flex flex-wrap gap-2 sm:col-start-2">
          <InkButton
            disabled={
              pending ||
              (!isLead &&
                (!canDeployBeast(beast, ownerLevel) || (!carried && full)))
            }
            onClick={() => lineup(isLead ? 'unlead' : 'lead')}
          >
            {isLead ? '取消首发' : '设为首发'}
          </InkButton>
          <InkButton
            disabled={pending || (!carried && full)}
            onClick={() => lineup('carry')}
          >
            {carried ? '移出编组' : '加入编组'}
          </InkButton>
          <InkButton
            disabled={pending || beast.currentLifespan >= beast.maxLifespan}
            onClick={() => act('rest')}
          >
            休养
          </InkButton>
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
            value:
              10 +
              beast.level +
              beast.allocatedAttributes[id as keyof typeof draft],
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
            <InkButton disabled={pending} onClick={() => setConfirming(false)}>
              返回调整
            </InkButton>
            <InkButton
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
          <InkButton disabled={pending} onClick={learn}>
            学习兽诀
          </InkButton>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {beast.skills.map((id) => {
            const skill = skills.get(id);
            const suppressed = !active.has(id);
            return (
              <InkTooltip
                key={id}
                label={`预览${skill?.name ?? '技能'}`}
                triggerClassName={`border-ink/20 bg-bgpaper hover:border-teal/60 hover:bg-teal/5 flex size-[68px] flex-col items-center justify-center gap-1 rounded-xs border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal ${suppressed ? 'opacity-50' : ''}`}
                triggerContent={
                  <>
                    <span aria-hidden className="text-2xl">
                      {id === 'beast.spirit-flame'
                        ? '🔥'
                        : id === 'beast.stone-guard'
                          ? '🛡️'
                          : id === 'beast.wind-strike'
                            ? '💨'
                            : '📜'}
                    </span>
                    <span className="w-full truncate px-1 text-xs">
                      {skill?.name ?? id}
                    </span>
                  </>
                }
              >
                <p className="text-teal">{skill?.name ?? id}</p>
                <p>{descriptions[id]?.description ?? '暂无技能说明'}</p>
                {suppressed ? (
                  <p className="text-crimson">被高级技能抑制，当前不生效。</p>
                ) : null}
              </InkTooltip>
            );
          })}
          {beast.skills.length === 0 ? (
            <p className="text-ink-secondary text-xs">尚未习得技能</p>
          ) : null}
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={
            reason ? 'text-crimson text-xs' : 'text-ink-secondary text-xs'
          }
        >
          {reason ?? (full && !carried ? '出战编组已满' : '可出战')}
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
