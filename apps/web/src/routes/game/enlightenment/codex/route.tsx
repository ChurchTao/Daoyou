import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { GameSceneTabs } from '@app/components/game-shell/GameSceneTabs';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNodeSlider } from '@app/components/ui/InkNodeSlider';
import { cn } from '@app/lib/cn';
import { CHARACTER_MANUALS_V1, manualRule } from '@daoyou/game-content/manuals';
import { CHARACTER_ATTRIBUTE_LABELS } from '@daoyou/game-domain/character';
import type { CharacterManualDefV1 } from '@daoyou/game-domain/manuals';
import { manualMechanismDescription } from '@daoyou/game-rules/manuals/presentation';
import {
  isAdvancedManual,
  manualAttributeValue,
} from '@daoyou/game-rules/manuals/projection';
import { useState } from 'react';

const realms = [...new Set(CHARACTER_MANUALS_V1.map((manual) => manual.realm))];

export default function ManualCodexPage() {
  const [realm, setRealm] = useState('all');
  const [manualId, setManualId] = useState<string>();
  const visible = CHARACTER_MANUALS_V1.filter(
    (manual) => realm === 'all' || manual.realm === realm,
  );
  const selected =
    visible.find((manual) => manual.id === manualId) ?? visible[0];

  return (
    <GameSceneFrame variant="workflow">
      <div className="text-ink-secondary flex items-center justify-between gap-3 text-xs">
        <span>
          共 <span className="font-mono">{visible.length}</span> 门功法
        </span>
        <InkButton href="/game/enlightenment">返回悟道室</InkButton>
      </div>
      <GameSceneTabs
        activeValue={realm}
        onChange={setRealm}
        items={[
          { value: 'all', label: '全部' },
          ...realms.map((value) => ({ value, label: value })),
        ]}
      />
      <div className="grid min-w-0 gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="border-ink/15 min-w-0 border-b pb-4 md:border-r md:border-b-0 md:pr-4 md:pb-0">
          <div
            key={realm}
            role="group"
            aria-label="功法名录"
            className="grid max-h-60 [scrollbar-width:thin] grid-cols-2 gap-1 overflow-y-auto overscroll-y-contain pr-2 md:max-h-[32rem] md:grid-cols-1"
          >
            {visible.map((manual) => (
              <button
                key={manual.id}
                type="button"
                aria-pressed={selected?.id === manual.id}
                onClick={() => setManualId(manual.id)}
                className={cn(
                  'hover:bg-teal/5 min-w-0 border-l-2 px-2 py-3 text-left transition-colors',
                  selected?.id === manual.id
                    ? 'border-teal bg-teal/8'
                    : 'border-transparent',
                )}
              >
                <span className="block text-sm">{manual.name}</span>
                <span className="text-ink-secondary text-xs">
                  {manual.realm} · {isAdvancedManual(manual) ? '高阶' : '基础'}
                </span>
              </button>
            ))}
          </div>
        </aside>
        {selected ? (
          <ManualCodexDetail key={selected.id} manual={selected} />
        ) : null}
      </div>
    </GameSceneFrame>
  );
}

function ManualCodexDetail({ manual }: { manual: CharacterManualDefV1 }) {
  const rule = manualRule(manual);
  const [level, setLevel] = useState(rule.maxLevel);

  return (
    <article
      className="min-w-0 space-y-5 text-sm"
      aria-label={`${manual.name}详情`}
    >
      <header>
        <h2 className="text-lg font-semibold">{manual.name}</h2>
        <p className="text-ink-secondary mt-1 text-xs">
          {isAdvancedManual(manual) ? '高阶功法' : '基础功法'} · 修习要求：
          {manual.realm} · 共 <span className="font-mono">{rule.maxLevel}</span>{' '}
          层
        </p>
        <p className="text-ink-secondary mt-3 leading-6">
          {manual.description}
        </p>
      </header>
      <InkNodeSlider
        label="效果层数"
        values={Array.from({ length: rule.maxLevel }, (_, index) => index + 1)}
        value={level}
        unit="层"
        onChange={setLevel}
      />
      <section className="border-ink/15 border-t pt-4" aria-label="属性增益">
        <h3 className="text-teal mb-2 text-sm">属性增益</h3>
        <dl className="grid gap-x-5 sm:grid-cols-2">
          {manual.effects.map((effect) => (
            <div
              key={effect.attribute}
              className="border-ink/8 flex items-baseline justify-between gap-3 border-b py-2"
            >
              <dt className="text-ink-secondary">
                {CHARACTER_ATTRIBUTE_LABELS[effect.attribute]}
              </dt>
              <dd className="font-mono font-semibold">
                +{manualAttributeValue(effect, level)}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <section aria-label="功法效果">
        <h3 className="text-teal mb-2 text-sm">运转效果</h3>
        <p className="leading-7">{manualMechanismDescription(manual, level)}</p>
      </section>
    </article>
  );
}
