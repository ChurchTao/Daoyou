import { InkButton } from '@app/components/ui/InkButton';
import { COMBAT_V6_SECT_DEFINITIONS_V4 } from '@shared/engine/combat-v6/content';
import { methodTrainingCost } from '@shared/engine/combat-v6/sect-progression';
import {
  SECT_PANEL_LABELS,
  sectSkillCatalog,
} from '@shared/engine/combat-v6/sect-progression/presentation';
import { useMemo, useState } from 'react';
import {
  actionProblem,
  actionReference,
  type SectWorkspaceProps,
} from './actions';

export function MethodsWorkbench({ view, pending, act }: SectWorkspaceProps) {
  const progress = view.progress!;
  const definition = COMBAT_V6_SECT_DEFINITIONS_V4[progress.sectId];
  const [methodId, setMethodId] = useState(definition.methods[0].id);
  const [skillId, setSkillId] = useState<string>();
  const method = definition.methods.find((entry) => entry.id === methodId)!;
  const level = progress.methods[method.id];
  const catalog = useMemo(
    () => sectSkillCatalog(progress, view.characterLevel),
    [progress, view.characterLevel],
  );
  const skills = catalog.filter(
    (entry) =>
      entry.methodId === method.id &&
      (!entry.passive ||
        definition.skills.some((skill) => skill.definition.id === entry.id)),
  );
  const skill = skills.find((entry) => entry.id === skillId) ?? skills[0];
  const action = {
    ...actionReference(view),
    action: 'train' as const,
    methodId,
  };
  const problem = actionProblem(view, action);
  const cap = Math.min(180, view.characterLevel + 10);
  const cost = level < cap ? methodTrainingCost(level + 1) : undefined;
  const panel = method.panel;
  return (
    <div className="mt-4 grid gap-5 md:grid-cols-[11rem_minmax(0,1fr)] md:gap-6">
      <nav
        className="border-ink/10 grid grid-cols-3 content-start gap-1 border-b pb-3 md:grid-cols-1 md:border-r md:border-b-0 md:pr-4 md:pb-0"
        aria-label="宗门心法"
      >
        {definition.methods.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className="text-ink-secondary hover:bg-ink/5 hover:text-ink aria-pressed:bg-crimson/8 aria-pressed:text-crimson focus-visible:outline-crimson/60 w-full cursor-pointer px-2 py-3 text-center text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none md:text-left"
            aria-pressed={entry.id === methodId}
            onClick={() => {
              setMethodId(entry.id);
              setSkillId(undefined);
            }}
          >
            <span>
              <span className="mb-1 block text-xs leading-relaxed md:text-sm">
                {entry.name.replace(/[《》]/g, '')}
              </span>
              <span className="text-ink-secondary text-xs leading-relaxed">
                {progress.methods[entry.id]}级
                {entry.isPrimary ? ' · 主心法' : ''}
              </span>
            </span>
          </button>
        ))}
      </nav>
      <section className="flex min-w-0 flex-col" aria-label={method.name}>
        <div className="flex flex-wrap items-center gap-2 [&>h3]:text-base [&>h3]:font-medium">
          <h3>{method.name.replace(/[《》]/g, '')}</h3>
          {method.isPrimary ? (
            <span className="text-ink-secondary text-xs">主心法</span>
          ) : null}
        </div>
        <p className="text-ink-secondary mt-2 text-sm leading-7">
          {panel
            ? `研习提升${SECT_PANEL_LABELS[panel.attr] ?? panel.attr}，并精进关联神通。`
            : '研习精进此卷关联的宗门神通。'}
        </p>
        {panel ? (
          <div
            className="[&_strong]:num-stat mt-4 flex items-center gap-6 py-4 md:gap-8 [&_strong]:mt-1 [&_strong]:block [&_strong]:text-2xl [&_strong]:font-normal"
            aria-live="polite"
          >
            <div>
              <span className="text-ink-secondary text-xs leading-relaxed">
                {SECT_PANEL_LABELS[panel.attr] ?? panel.attr} · 当前贡献
              </span>
              <strong>+{Math.floor(panel.value * level)}</strong>
            </div>
            {level < cap ? (
              <>
                <span className="text-ink-secondary" aria-hidden="true">
                  →
                </span>
                <div>
                  <span className="text-ink-secondary text-xs leading-relaxed">
                    研习至{level + 1}级
                  </span>
                  <strong className="text-crimson">
                    +{Math.floor(panel.value * (level + 1))}
                  </strong>
                </div>
              </>
            ) : (
              <span className="text-ink-secondary text-xs leading-relaxed">
                已达当前上限
              </span>
            )}
          </div>
        ) : null}
        <div className="flex-1 pt-5">
          <p className="text-ink-secondary mb-3 text-xs">关联神通</p>
          <div className="mb-4 flex flex-wrap gap-2" aria-label="关联神通">
            {skills.map((entry) => (
              <button
                type="button"
                key={entry.id}
                aria-pressed={entry.id === skill?.id}
                onClick={() => setSkillId(entry.id)}
                className="focus-visible:outline-crimson/60 text-ink-secondary hover:text-crimson aria-pressed:border-crimson/60 aria-pressed:text-crimson min-h-10 cursor-pointer border-b border-transparent px-1.5 py-2 text-sm transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-45 motion-reduce:transition-none"
              >
                {entry.name}
              </button>
            ))}
          </div>
          {skill ? (
            <section aria-live="polite">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                {skill.name}
                <span className="text-ink-secondary text-xs">
                  {skill.passive ? '被动' : '神通'}
                </span>
                <span className="text-ink-secondary text-xs leading-relaxed">
                  {skill.level}级
                </span>
              </div>
              {!skill.available ? (
                <p className="text-ink-secondary text-xs leading-relaxed">
                  {skill.requirement}
                </p>
              ) : null}
              <p className="text-ink-secondary mt-2 leading-7">
                {skill.description}
              </p>
            </section>
          ) : (
            <p className="text-ink-secondary text-xs leading-relaxed">
              此卷暂无关联神通。
            </p>
          )}
        </div>
        <footer className="border-ink/10 mt-6 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <div className="space-y-1 text-xs leading-relaxed">
            {cost ? (
              <p>
                {cost.cultivationExp.toLocaleString()} 修为 ·{' '}
                {cost.spiritStones.toLocaleString()} 灵石
              </p>
            ) : null}
            <span
              className={
                problem
                  ? 'text-crimson'
                  : 'text-ink-secondary text-xs leading-relaxed'
              }
            >
              {problem ?? `当前${level}级 · 上限${cap}级`}
            </span>
          </div>
          <InkButton
            type="button"
            variant="primary"
            className="focus-visible:outline-crimson/60 min-h-10 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none"
            disabled={pending || !!problem}
            pending={pending}
            pendingLabel="研习中……"
            onClick={() => void act(action)}
          >
            研习一级
          </InkButton>
        </footer>
      </section>
    </div>
  );
}
