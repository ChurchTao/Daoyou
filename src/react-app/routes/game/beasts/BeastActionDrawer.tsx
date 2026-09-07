import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import {
  beastPanel,
  type SummonedBeast,
} from '@shared/engine/combat-v6/beasts';
import {
  allocateBeast,
  BEAST_ATTRIBUTE_NAMES,
  beastRestCost,
} from '@shared/engine/combat-v6/beasts/progression';
import { useState } from 'react';

export type BeastAction = 'allocate' | 'release' | 'rest';
const labels = { allocate: '分配属性', release: '放生', rest: '休养' };
export function BeastActionDrawer({
  beast,
  action,
  ownerLevel,
  spiritStones,
  pending,
  error,
  close,
  confirm,
}: {
  beast: SummonedBeast;
  action: BeastAction;
  ownerLevel: number;
  spiritStones: number;
  pending: boolean;
  error?: string;
  close: () => void;
  confirm: (points?: typeof emptyPoints) => void;
}) {
  const [points, setPoints] = useState(emptyPoints);
  const total = Object.values(points).reduce((a, b) => a + b, 0);
  const valid =
    total > 0 && total <= beast.unallocatedPoints && beast.level <= ownerLevel;
  const before = beastPanel(beast);
  const after = valid
    ? beastPanel(allocateBeast(beast, points, ownerLevel))
    : before;
  const cost = beastRestCost(beast);
  return (
    <InkDetailDrawer
      isOpen
      title={`${labels[action]} · ${beast.name}`}
      onClose={close}
      size="sm"
      footer={
        <InkButton
          pending={pending}
          disabled={
            action === 'allocate'
              ? !valid
              : action === 'rest'
                ? cost <= 0 || cost > spiritStones
                : false
          }
          onClick={() => confirm(action === 'allocate' ? points : undefined)}
        >
          确认{labels[action]}
        </InkButton>
      }
    >
      {error ? (
        <p role="alert" className="text-crimson mb-3 text-sm">
          {error}
        </p>
      ) : null}
      {action === 'allocate' ? (
        <div className="space-y-4 text-sm">
          <p>剩余点数 {beast.unallocatedPoints - total} · 确认后不可撤销</p>
          {Object.entries(BEAST_ATTRIBUTE_NAMES).map(([key, name]) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3"
            >
              <span>{name}</span>
              <input
                className="border-ink/20 w-24 rounded border p-2"
                aria-label={`分配${name}`}
                type="number"
                min={0}
                step={1}
                max={beast.unallocatedPoints}
                value={points[key as keyof typeof points]}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (
                    Number.isInteger(value) &&
                    value >= 0 &&
                    value <= beast.unallocatedPoints
                  )
                    setPoints((p) => ({ ...p, [key]: value }));
                }}
              />
            </label>
          ))}
          <dl className="grid grid-cols-2 gap-2">
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
            ).map(([key, name]) => (
              <div key={key}>
                <dt>{name}</dt>
                <dd>
                  {before[key]} → {after[key]}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : action === 'rest' ? (
        <div className="space-y-3 text-sm">
          <p>
            恢复 {beast.maxLifespan - beast.currentLifespan} 点寿命，消耗 {cost}{' '}
            灵石。
          </p>
          <p>现有灵石 {spiritStones}</p>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <p>
            {beast.level} 级 · 成长 {beast.growth.toFixed(3)} ·{' '}
            {beast.skillSlotCapacity} 个技能格
          </p>
          <p>放生没有收益，无法找回。该灵兽会同时移出携带编组。</p>
        </div>
      )}
    </InkDetailDrawer>
  );
}
const emptyPoints = {
  constitution: 0,
  strength: 0,
  magic: 0,
  endurance: 0,
  agility: 0,
};
