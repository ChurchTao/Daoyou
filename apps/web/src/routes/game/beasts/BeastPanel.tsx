import { AttributeAllocation } from '@app/components/feature/attributes/AttributeAllocation';
import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastLockTag } from '@app/components/feature/beasts/BeastLockTag';
import { BeastMutationTag } from '@app/components/feature/beasts/BeastMutationTag';
import { BeastSkillGrid } from '@app/components/feature/beasts/BeastSkillGrid';
import { InkModal } from '@app/components/layout/InkModal';
import { GameIcon } from '@app/components/ui/GameIcon';
import { InkBadge } from '@app/components/ui/InkBadge';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTag } from '@app/components/ui/InkTag';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { BEAST_PROGRESSION, BEAST_SPECIES } from '@daoyou/game-content/beasts';
import { type SummonedBeast } from '@daoyou/game-domain/beasts';
import { getLevelRealmStage } from '@daoyou/game-domain/progression';
import {
  allocateBeast,
  BEAST_ATTRIBUTE_NAMES,
  beastOriginName,
  nextBeastExp,
} from '@daoyou/game-rules/beasts/growth';
import {
  beastAttributes,
  beastPanel,
} from '@daoyou/game-rules/beasts/projection';
import { useState } from 'react';
import type { BeastAction } from './BeastActionDrawer';

const species = new Map(BEAST_SPECIES.map((s) => [s.id as string, s]));
const panelStats = [
  ['maxHp', '气血'],
  ['maxMp', '法力'],
  ['physicalAtk', '物攻'],
  ['physicalDef', '物防'],
  ['magicAtk', '法攻'],
  ['magicDef', '法防'],
  ['speed', '速度'],
] as const;

function BeastLeadSeal() {
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

function BeastOption({
  icon,
  label,
  description,
  disabled,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="hover:bg-ink/5 focus-visible:outline-teal flex min-h-12 w-full items-center justify-between gap-3 px-2 py-3 text-left transition-colors focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <GameIcon value={icon} className="text-2xl" />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${danger ? 'text-crimson' : ''}`}>
          {label}
        </span>
        <span className="text-ink-secondary mt-1 block text-xs leading-5">
          {description}
        </span>
      </span>
      <span aria-hidden className="text-ink-secondary shrink-0">
        ›
      </span>
    </button>
  );
}

export function BeastPanel({
  beast,
  ownerLevel,
  isLead,
  pending,
  pendingLineup,
  lineup,
  withdraw,
  bagFull,
  act,
  setLocked,
  learn,
  refine,
  rejuvenate,
  feed,
  rename,
  allocate,
  store,
  warehouseFull,
  fuse,
}: {
  beast: SummonedBeast;
  ownerLevel: number;
  isLead: boolean;
  pending: boolean;
  pendingLineup?: 'lead' | 'unlead';
  lineup: (action: 'lead' | 'unlead') => void;
  withdraw?: () => void;
  bagFull?: boolean;
  act: (action: BeastAction) => void;
  setLocked: (isLocked: boolean) => void;
  learn: () => void;
  refine: () => void;
  rejuvenate: () => void;
  feed: () => void;
  rename: () => void;
  allocate: (points: SummonedBeast['allocatedAttributes']) => Promise<boolean>;
  store?: () => void;
  warehouseFull?: boolean;
  fuse?: () => void;
}) {
  const [draft, setDraft] = useState<SummonedBeast['allocatedAttributes']>({
    constitution: 0,
    strength: 0,
    magic: 0,
    endurance: 0,
    agility: 0,
  });
  const [confirming, setConfirming] = useState(false);
  const [tools, setTools] = useState<'cultivate' | 'manage' | null>(null);
  function choose(action: () => void) {
    setTools(null);
    action();
  }
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
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <h2
                className="min-w-0 truncate text-lg @min-[30rem]:text-xl"
                title={beast.name}
              >
                {beast.name}
              </h2>
              <BeastLockTag isLocked={beast.isLocked} />
              {beast.isMutant ? (
                <BeastMutationTag isMutant />
              ) : (
                <InkTag className="shrink-0 text-xs">
                  {beastOriginName(beast)}
                </InkTag>
              )}
            </div>
            <div className="text-ink-secondary flex items-center gap-1 text-xs leading-6 whitespace-nowrap">
              {definition && beast.name !== definition.name ? (
                <>
                  <span className="min-w-0 truncate" title={definition.name}>
                    {definition.name}
                  </span>
                  <span aria-hidden>·</span>
                </>
              ) : null}
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
          <div className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 @min-[30rem]:mt-2">
            {withdraw ? null : (
              <div className="flex items-center">
                <InkButton
                  variant={isLead ? 'secondary' : 'primary'}
                  pending={
                    pending &&
                    (pendingLineup === 'lead' || pendingLineup === 'unlead')
                  }
                  disabled={pending || (!isLead && !!reason)}
                  onClick={() => lineup(isLead ? 'unlead' : 'lead')}
                >
                  {isLead ? '取消首发' : '设为首发'}
                </InkButton>
                {!isLead && reason ? (
                  <InkTooltip label="设为首发条件">{reason}</InkTooltip>
                ) : null}
              </div>
            )}
            {withdraw ? (
              <div className="flex items-center">
                <InkButton
                  variant="primary"
                  disabled={pending || bagFull}
                  onClick={withdraw}
                >
                  取出到灵兽袋
                </InkButton>
                {bagFull ? (
                  <InkTooltip label="取出条件">
                    灵兽袋已满，请先空出空间。
                  </InkTooltip>
                ) : null}
              </div>
            ) : null}
            <InkButton disabled={pending} onClick={() => setTools('cultivate')}>
              培养
            </InkButton>
            <InkButton disabled={pending} onClick={() => setTools('manage')}>
              管理
            </InkButton>
          </div>
        </div>
      </div>
      <div className="border-ink/15 grid gap-5 border-t pt-4 lg:grid-cols-[1.15fr_1fr] lg:gap-7">
        <section>
          <h3 className="text-teal mb-2 text-sm">战斗属性</h3>
          <dl className="grid grid-cols-2 gap-x-5">
            {panelStats.map(([key, label]) => (
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
      />
      <InkDetailDrawer
        isOpen={tools !== null}
        title={`${tools === 'cultivate' ? '培养' : '管理'} · ${beast.name}`}
        onClose={() => setTools(null)}
        size="md"
      >
        {tools === 'cultivate' ? (
          <div className="divide-ink/10 divide-y">
            <BeastOption
              icon="🍑"
              label="喂养"
              description={
                capped
                  ? '使用丹药或灵果提升等级，已达当前培养上限'
                  : '使用丹药或灵果，为灵兽增加修为、提升等级'
              }
              disabled={pending || capped}
              onClick={() => choose(feed)}
            />
            <BeastOption
              icon="🌿"
              label="休养"
              description={
                beast.currentLifespan >= beast.maxLifespan
                  ? '消耗灵石恢复寿命，当前寿命已满'
                  : '消耗灵石恢复寿命，让灵兽继续随行出战'
              }
              disabled={pending || beast.currentLifespan >= beast.maxLifespan}
              onClick={() => choose(() => act('rest'))}
            />
            <BeastOption
              icon="📜"
              label="领悟传承"
              description="使用传承灵印学习技能，可能替换已有技能"
              disabled={pending}
              onClick={() => choose(learn)}
            />
            <BeastOption
              icon="💧"
              label="洗炼"
              description="重新生成资质、成长与技能，等级和修为归零"
              disabled={pending}
              onClick={() => choose(refine)}
            />
            <BeastOption
              icon="🍒"
              label="洗点"
              description="使用化生果退回已分配属性点，重新安排加点"
              disabled={pending}
              onClick={() => choose(rejuvenate)}
            />
          </div>
        ) : (
          <div className="divide-ink/10 divide-y">
            <BeastOption
              icon={beast.isLocked ? '🔓' : '🔒'}
              label={beast.isLocked ? '解锁' : '锁定'}
              description={
                beast.isLocked
                  ? '解除保护，允许融合、寄售、回收与放生'
                  : '禁止融合、寄售、回收与放生，保护这只灵兽'
              }
              disabled={pending}
              onClick={() => choose(() => setLocked(!beast.isLocked))}
            />
            <BeastOption
              icon="✍️"
              label="改名"
              description="为这只灵兽取一个新的名字"
              disabled={pending}
              onClick={() => choose(rename)}
            />
            {store ? (
              <BeastOption
                icon="📦"
                label="存入仓库"
                description={
                  warehouseFull
                    ? '寄存暂不出行的灵兽，当前仓库已满'
                    : '寄存暂不出行的灵兽，存入后取消首发'
                }
                disabled={pending || warehouseFull}
                onClick={() => choose(store)}
              />
            ) : null}
            {fuse ? (
              <BeastOption
                icon="icon:beast-fusion-cauldron"
                label="融合"
                description={
                  beast.isLocked
                    ? '两只灵兽融合为新个体，当前已锁定，请先解锁'
                    : '消耗两只灵兽，融合成一只新的灵兽'
                }
                disabled={pending || beast.isLocked}
                onClick={() => choose(fuse)}
              />
            ) : null}
            <BeastOption
              icon="🕊️"
              label="放生"
              description={
                beast.isLocked
                  ? '放生后无法找回，当前已锁定，请先解锁'
                  : isLead
                    ? '放生后无法找回，请先取消首发'
                    : '放生没有收益，无法找回'
              }
              disabled={pending || isLead || beast.isLocked}
              danger
              onClick={() => choose(() => act('release'))}
            />
          </div>
        )}
      </InkDetailDrawer>
      <InkModal
        isOpen={confirming}
        onClose={() => {
          if (!pending) {
            setConfirming(false);
          }
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
        <h3 className="text-teal mb-3 text-sm">技能</h3>
        <BeastSkillGrid skills={beast.skills} />
      </section>
      {reason ? <p className="text-crimson text-xs">{reason}</p> : null}
    </div>
  );
}
