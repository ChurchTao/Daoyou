import { BeastIcon } from '@app/components/feature/beasts/BeastIcon';
import { BeastSkillTile } from '@app/components/feature/beasts/BeastSkillTile';
import { InkButton } from '@app/components/ui/InkButton';
import { InkTag } from '@app/components/ui/InkTag';
import type { SummonedBeast } from '@shared/engine/combat-v6/beasts';

export function FusionIdentityTag({ beast }: { beast: SummonedBeast }) {
  return (
    <InkTag className={`text-xs ${beast.isMutant ? 'text-violet-600' : ''}`}>
      {beast.isMutant
        ? '变异'
        : beast.originKind === 'wild'
          ? '成年'
          : beast.originKind === 'pseudo_baby'
            ? '成年'
            : '幼崽'}
    </InkTag>
  );
}

export function FusionBeastPanel({
  beast,
  side,
  locked,
  onSelect,
  onRemove,
}: {
  beast?: SummonedBeast;
  side?: '左' | '右';
  locked?: boolean;
  onSelect?: () => void;
  onRemove?: () => void;
}) {
  return (
    <section
      aria-label={side ? `${side}侧灵兽` : '新生灵兽'}
      className="min-w-0"
    >
      {side && (
        <p className="text-ink-secondary mb-3 text-center text-xs tracking-widest">
          {side}侧灵兽
        </p>
      )}
      {beast ? (
        <>
          <div className="relative flex justify-center py-2">
            <div
              aria-hidden
              className="bg-teal/8 absolute inset-x-3 bottom-0 h-9 rounded-[50%] blur-lg"
            />
            <BeastIcon
              speciesId={beast.speciesId}
              isMutant={beast.isMutant}
              className="relative text-[88px] sm:text-[104px]"
            />
          </div>
          <div className="mt-3 text-center">
            <h2 className="text-sm font-semibold break-words sm:text-base">
              {beast.name}
            </h2>
            <div className="text-ink-secondary mt-1 flex flex-wrap items-center justify-center gap-1 text-xs">
              <span>
                <span className="font-mono">{beast.level}</span> 级
              </span>
              <FusionIdentityTag beast={beast} />
            </div>
            {onSelect && (
              <div className="my-2 flex flex-wrap justify-center gap-1">
                <InkButton
                  disabled={locked}
                  onClick={onSelect}
                  className="min-h-11 text-sm"
                >
                  更换
                </InkButton>
                <InkButton
                  disabled={locked}
                  onClick={onRemove}
                  variant="ghost"
                  className="min-h-11 text-sm"
                >
                  移除
                </InkButton>
              </div>
            )}
          </div>
          <dl className="border-ink/10 mt-4 grid grid-cols-1 gap-x-4 gap-y-2 border-t pt-4 text-xs sm:grid-cols-2">
            {(
              [
                ['attack', '攻击资质'],
                ['defense', '防御资质'],
                ['health', '体力资质'],
                ['mana', '法力资质'],
                ['speed', '速度资质'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex flex-wrap justify-between gap-x-1">
                <dt className="text-ink-secondary">{label}</dt>
                <dd className="font-mono">{beast.aptitudes[key]}</dd>
              </div>
            ))}
            <div className="flex justify-between gap-1">
              <dt className="text-ink-secondary">成长</dt>
              <dd className="font-mono">{beast.growth.toFixed(3)}</dd>
            </div>
          </dl>
          <div className="mt-5">
            <p className="text-ink-secondary mb-2 text-xs">
              技能 <span className="font-mono">{beast.skills.length}</span>
            </p>
            <div
              role="group"
              aria-label={`${beast.name}的技能`}
              className="grid grid-cols-2 gap-1.5 sm:grid-cols-4"
            >
              {beast.skills.map((id) => (
                <BeastSkillTile key={id} skillId={id} />
              ))}
            </div>
            {beast.skills.length === 0 && (
              <p className="text-ink-secondary text-xs">暂无技能</p>
            )}
          </div>
        </>
      ) : (
        <button
          type="button"
          disabled={locked}
          onClick={onSelect}
          aria-label={`选择${side}侧灵兽`}
          className="group hover:bg-teal/5 focus-visible:outline-teal bg-ink/[0.025] flex min-h-64 w-full flex-col items-center justify-center gap-4 rounded-[50%_50%_4px_4px] px-2 transition-colors disabled:opacity-50 md:min-h-96"
        >
          <span
            aria-hidden
            className="border-ink/20 text-ink-secondary group-hover:border-teal flex size-16 items-center justify-center rounded-full border border-dashed text-3xl font-light"
          >
            ＋
          </span>
          <span className="text-sm">选择灵兽</span>
          <span className="text-ink-secondary text-xs">查看资质与技能</span>
        </button>
      )}
    </section>
  );
}
