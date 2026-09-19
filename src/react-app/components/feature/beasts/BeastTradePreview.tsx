import { InkModal } from '@app/components/layout';
import type { BeastTradePreview as Preview } from '@shared/contracts/beastTrade';
import {
  BEAST_PROGRESSION,
  BEAST_SPECIES,
} from '@shared/engine/combat-v6/beasts/content';
import { BEAST_ATTRIBUTE_NAMES } from '@shared/engine/combat-v6/beasts/progression';
import { beastAttributes } from '@shared/engine/combat-v6/beasts/projection';
import { useState } from 'react';
import { BeastIcon } from './BeastIcon';
import { BeastMutationTag } from './BeastMutationTag';
import { BeastSkillTile } from './BeastSkillTile';

export function BeastTradeDetails({ beast }: { beast: Preview }) {
  const species = BEAST_SPECIES.find((s) => s.id === beast.speciesId);
  const attributes = beastAttributes(beast);
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center gap-3">
        <BeastIcon
          speciesId={beast.speciesId}
          isMutant={beast.isMutant}
          className="text-6xl"
        />
        <div>
          <p>
            {beast.name} <BeastMutationTag isMutant={beast.isMutant} />
          </p>
          <p className="text-ink-secondary">
            {species?.name} · <span className="font-mono">{beast.level}</span>级
          </p>
          <p>
            参战等级 <span className="font-mono">{species?.carryLevel}</span> ·
            经验 <span className="font-mono">{beast.exp}</span>
          </p>
        </div>
      </div>
      <p>
        成长 <span className="font-mono">{beast.growth.toFixed(3)}</span> · 寿命{' '}
        <span className="font-mono">
          {beast.currentLifespan}/{beast.maxLifespan}
        </span>
      </p>
      {beast.currentLifespan < BEAST_PROGRESSION.lifespan.deployMinimum && (
        <p className="text-crimson">
          寿命不足，领取后须先休养才能出战。交易不恢复寿命。
        </p>
      )}
      <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
        {(
          [
            ['attack', '攻击资质'],
            ['defense', '防御资质'],
            ['health', '体力资质'],
            ['mana', '法力资质'],
            ['speed', '速度资质'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="flex justify-between gap-2">
            <dt>{label}</dt>
            <dd className="font-mono">{beast.aptitudes[key]}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="mb-2">
          技能{' '}
          <span className="font-mono">
            {beast.skills.length}/{beast.skillSlotCapacity}
          </span>
        </p>
        <div
          className="grid grid-cols-[repeat(auto-fill,4rem)] gap-2"
          role="group"
          aria-label="灵兽技能"
        >
          {beast.skills.map((id) => (
            <BeastSkillTile key={id} skillId={id} />
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2">
          当前属性 · 可分配{' '}
          <span className="font-mono">{beast.unallocatedPoints}</span> 点
        </p>
        <dl className="grid grid-cols-2 gap-x-5 gap-y-2">
          {Object.entries(BEAST_ATTRIBUTE_NAMES).map(([key, label]) => (
            <div key={key} className="flex justify-between gap-2">
              <dt>{label}</dt>
              <dd className="font-mono">
                {attributes[key as keyof Preview['allocatedAttributes']]}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

export function BeastTradeSlot({ beast }: { beast: Preview }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`查看灵兽 ${beast.name}`}
        className="border-ink/20 hover:border-ink/50 w-full rounded border p-1"
        onClick={() => setOpen(true)}
      >
        <BeastIcon
          speciesId={beast.speciesId}
          isMutant={beast.isMutant}
          className="text-4xl"
        />
      </button>
      {open && (
        <InkModal isOpen title={beast.name} onClose={() => setOpen(false)}>
          <BeastTradeDetails beast={beast} />
        </InkModal>
      )}
    </>
  );
}
