import { GameIcon } from '@app/components/ui/GameIcon';
import { InkTag } from '@app/components/ui/InkTag';
import type { TowerView } from '@shared/contracts/combatV6Tower';
import type { TowerEnemyRole } from '@shared/lib/tower/formations';
import { useState } from 'react';

const ROLE_LABELS: Record<TowerEnemyRole, string> = {
  leader: '主敌',
  striker: '协攻',
  healer: '疗伤',
  guard: '护卫',
};

export function TowerWeeklyEnemies({ view }: { view: TowerView }) {
  const enemies = [...view.weeklyEnemies].sort((a, b) => a.floor - b.floor);
  const highest = Math.max(
    0,
    ...view.rewards.map((reward) => reward.floor),
    view.state?.season.seasonKey === view.season.seasonKey
      ? view.state.highestFloor
      : 0,
  );
  const next = enemies.find((enemy) => enemy.floor > highest);
  const [selected, setSelected] = useState(
    next?.floor ?? enemies[enemies.length - 1]?.floor,
  );
  const enemy = enemies.find((enemy) => enemy.floor === selected) ?? enemies[0];
  if (!enemy)
    return (
      <p className="text-ink-secondary py-8 text-center text-sm">
        本周强敌尚未显现。
      </p>
    );
  const companions = enemy.members.filter((member) => member.role !== 'leader');
  return (
    <div className="space-y-7">
      <div
        role="group"
        aria-label="关键层路线"
        className="grid grid-cols-4 gap-2"
      >
        {enemies.map((foe) => {
          const active = foe.floor === enemy.floor;
          return (
            <button
              key={foe.floor}
              type="button"
              aria-label={`第${foe.floor}层${foe.kind === 'boss' ? '首领' : '精英'}${foe.floor <= highest ? '，已通过' : foe.floor === next?.floor ? '，下一关键层' : ''}`}
              aria-pressed={active}
              aria-controls="tower-weekly-enemy"
              onClick={() => setSelected(foe.floor)}
              className={`hover:bg-ink/6 focus-visible:outline-ink cursor-pointer border-b-2 px-1 py-3 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${active ? 'border-crimson bg-ink/5 text-ink' : 'border-ink/10 text-ink-secondary'}`}
            >
              <span
                className={`block font-mono text-2xl ${active ? 'text-crimson font-semibold' : ''}`}
              >
                {String(foe.floor).padStart(2, '0')}
                <span className="ml-1 font-sans text-xs">层</span>
              </span>
              <span className="mt-1 block text-sm">
                {foe.kind === 'boss' ? '首领' : '精英'}
              </span>
              <span className="text-ink-secondary mt-1 block min-h-4 text-xs">
                {foe.floor <= highest
                  ? '✓ 已通过'
                  : foe.floor === next?.floor
                    ? '下一关'
                    : '\u00a0'}
              </span>
            </button>
          );
        })}
      </div>
      <section
        key={enemy.floor}
        id="tower-weekly-enemy"
        aria-label={`第${enemy.floor}层强敌`}
        className="space-y-6"
      >
        <div className="flex items-center gap-4 sm:gap-6">
          <GameIcon
            value={enemy.icon}
            className="shrink-0 text-5xl sm:text-6xl"
          />
          <div className="min-w-0">
            <p
              className={`mb-1 text-sm ${enemy.kind === 'boss' ? 'text-crimson' : 'text-ink-secondary'}`}
            >
              {enemy.floor === 20
                ? '最终首领'
                : enemy.kind === 'boss'
                  ? '守关首领'
                  : '精英守卫'}
            </p>
            <h2 className="text-xl font-semibold sm:text-2xl">{enemy.name}</h2>
            <p className="text-ink-secondary mt-1 text-sm">
              {companions.length ? (
                <>
                  携 <span className="font-mono">{companions.length}</span>{' '}
                  名随从迎战
                </>
              ) : (
                '独自镇守'
              )}
            </p>
          </div>
        </div>
        <ul aria-label="阵容特性" className="flex flex-wrap gap-2">
          {enemy.labels.map((label) => (
            <li key={label}>
              <InkTag className="bg-ink/5 rounded-sm px-2 py-1">{label}</InkTag>
            </li>
          ))}
        </ul>
        {companions.length ? (
          <ul aria-label="随从阵容" className="flex flex-wrap gap-x-6 gap-y-3">
            {companions.map((member) => (
              <li key={member.id} className="flex items-center gap-2.5">
                <GameIcon value={member.icon} className="text-2xl" />
                <div>
                  <p className="text-sm">{member.name}</p>
                  <p className="text-ink-secondary text-xs">
                    {ROLE_LABELS[member.role]}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <details className="border-ink/15 border-t pt-3 text-sm">
          <summary className="text-ink-secondary hover:text-ink focus-visible:outline-ink cursor-pointer py-2 focus-visible:outline-2 focus-visible:outline-offset-2">
            查看战斗机制
          </summary>
          <div className="mt-3 space-y-5">
            {enemy.members.map((member) => (
              <div key={member.id}>
                {enemy.members.length > 1 ? (
                  <h3 className="mb-2 font-semibold">
                    {member.name}
                    <span className="text-ink-secondary ml-2 font-normal">
                      {ROLE_LABELS[member.role]}
                    </span>
                  </h3>
                ) : null}
                <ul className="text-ink-secondary space-y-2 leading-6">
                  {member.details.map((detail, index) => (
                    <li key={index}>{detail}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
