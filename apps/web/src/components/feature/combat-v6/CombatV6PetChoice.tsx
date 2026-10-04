import { BeastPortrait } from '@app/components/feature/beasts/BeastPortrait';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useState, type ReactNode } from 'react';
import type { CombatV6Session } from './session';

export function CombatV6PetChoice({
  timing,
  session,
  onClose,
  onSummon,
  onRecall,
}: {
  timing?: ReactNode;
  session: CombatV6Session;
  onClose: () => void;
  onSummon: (id: string) => void;
  onRecall: () => void;
}) {
  const options = session.commandOptions;
  const pets = options?.summonablePets ?? [];
  const [selectedId, setSelectedId] = useState(pets[0]?.id);
  const selected = pets.find((pet) => pet.id === selectedId) ?? pets[0];
  const current = session.units.find(
    (unit) => unit.ownerId === options?.unitId && !unit.dead && !unit.escaped,
  );
  const appearance = (id: string) => session.display?.unitAppearances?.[id];
  const portrait = (id: string) => (
    <BeastPortrait
      value={appearance(id)?.icon ?? '🐾'}
      isMutant={appearance(id)?.isMutant}
    />
  );
  return (
    <InkDetailDrawer
      isOpen
      title="灵兽"
      description={timing}
      size="lg"
      className="cv6-choice-drawer"
      onClose={onClose}
      footer={
        selected ? (
          <div className="cv6-choice-footer">
            <span>
              {current ? `替换 ${current.name}` : '占用人物本回合行动'}
            </span>
            <InkButton variant="primary" onClick={() => onSummon(selected.id)}>
              召唤 {selected.name}
            </InkButton>
          </div>
        ) : undefined
      }
    >
      <div className="cv6-current-pet">
        <span className="cv6-choice-eyebrow">当前在场</span>
        {current ? (
          <>
            <span className="cv6-current-pet-identity">
              {portrait(current.id)}
              <strong>{current.name}</strong>
            </span>
            {options?.canRecall ? (
              <InkButton variant="secondary" onClick={onRecall}>
                召回
              </InkButton>
            ) : null}
          </>
        ) : (
          <span className="cv6-muted">暂无灵兽</span>
        )}
      </div>
      {selected ? (
        <div className="cv6-choice-layout">
          <div className="cv6-choice-list" aria-label="可召唤灵兽">
            {pets.map((pet) => (
              <button
                key={pet.id}
                className="cv6-choice-option cv6-pet-option"
                aria-pressed={selected.id === pet.id}
                onClick={() => setSelectedId(pet.id)}
              >
                {portrait(pet.id)}
                <span>
                  <span className="cv6-choice-option-title">
                    <strong>{pet.name}</strong>
                    <span aria-hidden>
                      {selected.id === pet.id ? '✓' : '›'}
                    </span>
                  </span>
                  <span className="cv6-choice-option-meta">
                    气血{' '}
                    <span className="font-mono">
                      {Math.round((pet.hp / Math.max(1, pet.maxHp)) * 100)}%
                    </span>
                  </span>
                </span>
              </button>
            ))}
          </div>
          <section
            className="cv6-choice-preview"
            aria-label={`${selected.name}召唤预览`}
          >
            <div className="cv6-pet-preview-identity">
              {portrait(selected.id)}
              <div>
                <h3>{selected.name}</h3>
                {appearance(selected.id)?.speciesName !== selected.name ? (
                  <p className="cv6-choice-scope">
                    {appearance(selected.id)?.speciesName}
                  </p>
                ) : null}
              </div>
            </div>
            <dl className="cv6-pet-vitals">
              {[
                {
                  name: '气血',
                  value: selected.hp,
                  max: selected.maxHp,
                  className: 'is-hp',
                },
                {
                  name: '法力',
                  value: selected.mp,
                  max: selected.maxMp,
                  className: 'is-mp',
                },
              ].map((stat) => (
                <div key={stat.name}>
                  <dt>{stat.name}</dt>
                  <dd className="font-mono">
                    {stat.value}
                    <small> / {stat.max}</small>
                  </dd>
                  <span
                    className={`cv6-pet-meter ${stat.className}`}
                    aria-hidden
                  >
                    <span
                      style={{
                        width: `${Math.max(0, Math.min(100, (stat.value / Math.max(1, stat.max)) * 100))}%`,
                      }}
                    />
                  </span>
                </div>
              ))}
            </dl>
          </section>
        </div>
      ) : (
        <div className="cv6-choice-empty">
          <strong>暂无可召唤灵兽</strong>
        </div>
      )}
    </InkDetailDrawer>
  );
}
