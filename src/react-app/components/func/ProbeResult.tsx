import { FateEffectInlineList } from '@app/components/feature/fates/FateEffectInlineList';
import { toFateDisplayModel } from '@app/components/feature/fates/FateDisplayAdapter';
import { tierColorMap, type Tier } from '@app/components/ui/InkBadge';
import { cn } from '@shared/lib/cn';
import type { Artifact, Attributes, Cultivator } from '@shared/types/cultivator';
import { getEquipmentSlotInfo } from '@shared/types/dictionaries';

export type ProbeResultData = {
  cultivator: Cultivator;
  finalAttributes: Attributes;
};

/**
 * 格式化查探结果为InkDialog内容
 */
export function formatProbeResultContent(probeResult: ProbeResultData) {
  if (!probeResult) return null;

  const target = probeResult.cultivator;
  const finalAttrs = probeResult.finalAttributes;

  // 通用章节头部
  const SectionHeader = ({ icon, title }: { icon: string; title: string }) => (
    <div className="group mb-4 flex items-center gap-3">
      <div className="bg-ink/4 border-ink/10 group-hover:bg-ink/[0.07] flex h-8 w-8 items-center justify-center border border-dashed text-lg transition-colors">
        {icon}
      </div>
      <h4 className="text-ink-primary text-lg font-bold tracking-wide">
        {title}
      </h4>
      <div className="border-ink/10 ml-2 flex-1 border-t border-dashed" />
    </div>
  );

  // 格式化单个属性：基础 → 最终
  const formatAttr = (label: string, base: number, final: number) => {
    const isModified = base !== final;
    return (
      <div className="bg-ink/3 border-ink/10 hover:bg-ink/6 flex flex-col gap-1 border border-dashed p-3 transition-colors">
        <span className="text-ink-secondary text-xs tracking-widest opacity-70">
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-ink-primary text-lg font-bold">{final}</span>
          {isModified && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="line-through opacity-40">{base}</span>
              <span className="text-crimson bg-crimson/5 border-crimson/20 border px-1 font-medium">
                {final > base ? `+${final - base}` : final - base}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const getEquippedArtifact = (id: string | null): Artifact | null => {
    if (!id || !target.inventory?.artifacts) return null;
    return target.inventory.artifacts.find((a) => a.id === id) ?? null;
  };

  const renderEquipmentItem = (
    type: 'weapon' | 'armor' | 'accessory',
    item: Artifact | null,
  ) => {
    const slotInfo = getEquipmentSlotInfo(type);
    if (!item) {
      return (
        <div className="bg-ink/2 border-ink/10 flex items-center gap-4 border border-dashed p-3 opacity-40 grayscale">
          <div className="bg-ink/5 border-ink/10 flex h-10 w-10 items-center justify-center border border-dashed text-xl">
            {slotInfo.icon}
          </div>
          <span className="text-ink-secondary text-sm italic">
            未佩戴{slotInfo.label}
          </span>
        </div>
      );
    }

    const tierClass = item.quality ? tierColorMap[item.quality as Tier] : '';

    return (
      <div className="bg-ink/3 border-ink/10 group hover:bg-ink/6 border border-dashed p-4 transition-colors">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-ink/5 border-ink/10 flex h-10 w-10 items-center justify-center border border-dashed text-xl">
              {slotInfo.icon}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span
                  className={cn('text-base font-bold tracking-wide', tierClass)}
                >
                  {item.name}
                </span>
                {item.quality && (
                  <span
                    className={cn(
                      'border border-current/20 bg-current/5 px-1.5 py-0.5 text-[10px] font-medium uppercase',
                      tierClass,
                    )}
                  >
                    {item.quality}
                  </span>
                )}
              </div>
              <span className="text-ink-secondary/60 mt-0.5 text-[10px]">
                {item.element} · {slotInfo.label}
              </span>
            </div>
          </div>
        </div>
        {item.description && (
          <div className="text-ink-secondary/80 border-ink/5 mt-3 border-l-2 pl-1 text-justify text-sm leading-relaxed">
            {item.description}
          </div>
        )}
      </div>
    );
  };

  const weapon = getEquippedArtifact(target.equipped.weapon);
  const armor = getEquippedArtifact(target.equipped.armor);
  const accessory = getEquippedArtifact(target.equipped.accessory);

  return (
    <div className="scrollbar-hide max-h-[70vh] space-y-10 overflow-y-auto px-1 pb-6">
      {/* 身份摘要 */}
      <section className="bg-ink/3 border-ink/10 relative overflow-hidden border border-dashed p-6">
        {/* 背景大字装饰 */}
        <div className="pointer-events-none absolute -top-4 -right-2 text-8xl font-black opacity-[0.03] select-none">
          {target.realm}
        </div>

        <div className="relative flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-ink-primary text-2xl font-bold tracking-tight">
              {target.name}
            </h3>
            {target.title && (
              <span className="bg-ink/5 text-ink-secondary border-ink/10 border border-dashed px-2.5 py-1 text-xs">
                {target.title}
              </span>
            )}
          </div>

          <div className="text-ink-secondary flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="opacity-50">性别</span>
              <span className="text-ink-primary">{target.gender}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="opacity-50">境界</span>
              <span
                className={cn('font-bold', tierColorMap[target.realm as Tier])}
              >
                {target.realm} · {target.realm_stage}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 属性面板 */}
      <section>
        <SectionHeader icon="📊" title="根基底蕴" />
        <div className="grid grid-cols-2 gap-3 px-1 sm:grid-cols-3">
          {formatAttr('体魄', target.attributes.vitality, finalAttrs.vitality)}
          {formatAttr('灵力', target.attributes.spirit, finalAttrs.spirit)}
          {formatAttr('悟性', target.attributes.wisdom, finalAttrs.wisdom)}
          {formatAttr('速度', target.attributes.speed, finalAttrs.speed)}
          {formatAttr(
            '神识',
            target.attributes.willpower,
            finalAttrs.willpower,
          )}
        </div>
      </section>

      {/* 装备 */}
      <section>
        <SectionHeader icon="🛡️" title="随身法宝" />
        <div className="space-y-3">
          {renderEquipmentItem('weapon', weapon)}
          {renderEquipmentItem('armor', armor)}
          {renderEquipmentItem('accessory', accessory)}
        </div>
      </section>

      {/* 灵根 */}
      {target.spiritual_roots && target.spiritual_roots.length > 0 && (
        <section>
          <SectionHeader icon="🌱" title="灵根天赋" />
          <div className="flex flex-wrap gap-3 px-1">
            {target.spiritual_roots.map((root, idx) => {
              const tierClass = root.grade
                ? tierColorMap[root.grade as Tier]
                : '';
              return (
                <div
                  key={`${root.element}-${idx}`}
                  className="bg-ink/3 border-ink/10 flex min-w-20 flex-col gap-1 border border-dashed p-3"
                >
                  <span className="text-ink-secondary/60 text-xs uppercase">
                    {root.element}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-primary text-base font-bold">
                      {root.strength}
                    </span>
                    {root.grade && (
                      <span
                        className={cn('text-[10px] font-medium', tierClass)}
                      >
                        {root.grade}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 先天命格 */}
      {target.pre_heaven_fates && target.pre_heaven_fates.length > 0 && (
        <section>
          <SectionHeader icon="🔮" title="先天命格" />
          <div className="grid grid-cols-1 gap-3 px-1">
            {target.pre_heaven_fates.map((fate, idx) => {
              const fateDisplay = toFateDisplayModel(fate);
              const tierClass = fate.quality
                ? tierColorMap[fate.quality as Tier]
                : '';
              return (
                <div
                  key={fate.name + idx}
                  className="bg-ink/3 border-ink/10 group hover:bg-ink/6 border border-dashed p-4 transition-colors"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-base font-bold tracking-wide',
                        tierClass,
                      )}
                    >
                      {fate.name}
                    </span>
                    {fate.quality && (
                      <span
                        className={cn(
                          'border border-current/20 bg-current/5 px-1.5 py-0.5 text-[10px] font-medium',
                          tierClass,
                        )}
                      >
                        {fate.quality}
                      </span>
                    )}
                  </div>
                  {fate.description && (
                    <div className="text-ink-secondary/80 border-ink/10 border-l-2 pl-3 text-justify text-sm leading-relaxed italic">
                      {fate.description}
                    </div>
                  )}
                  <div className="mt-3">
                    <FateEffectInlineList lines={fateDisplay.previewLines} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 功法与神通 */}
      <div className="space-y-10">
        {target.skills && target.skills.length > 0 && (
          <section>
            <SectionHeader icon="⚡" title="修习神通" />
            <div className="grid grid-cols-1 gap-3 px-1">
              {target.skills.map((skill, idx) => {
                const tierClass = skill.quality
                  ? tierColorMap[skill.quality as Tier]
                  : '';
                return (
                  <div
                    key={skill.id || skill.name + idx}
                    className="bg-ink/3 border-ink/10 group hover:bg-ink/6 border border-dashed p-4 transition-colors"
                  >
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex flex-col">
                        <span
                          className={cn(
                            'text-base font-bold tracking-wide',
                            tierClass,
                          )}
                        >
                          {skill.name}
                        </span>
                        <span className="text-ink-secondary/60 mt-0.5 text-[10px] tracking-tighter uppercase">
                          {skill.element}
                        </span>
                      </div>
                      {skill.quality && (
                        <span
                          className={cn(
                            'border border-current/20 bg-current/5 px-1.5 py-0.5 text-[10px] font-medium',
                            tierClass,
                          )}
                        >
                          {skill.quality}
                        </span>
                      )}
                    </div>
                    {skill.description && (
                      <div className="text-ink-secondary/80 border-ink/5 group-hover:border-ink/20 border-l-2 pl-3 text-justify text-sm leading-relaxed transition-colors">
                        {skill.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {target.cultivations && target.cultivations.length > 0 && (
          <section>
            <SectionHeader icon="📖" title="修炼功法" />
            <div className="grid grid-cols-1 gap-3 px-1">
              {target.cultivations.map((cult, idx) => {
                const tierClass = cult.quality
                  ? tierColorMap[cult.quality as Tier]
                  : '';
                return (
                  <div
                    key={cult.name + idx}
                    className="bg-ink/3 border-ink/10 group hover:bg-ink/6 border border-dashed p-4 transition-colors"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span
                        className={cn(
                          'text-base font-bold tracking-wide',
                          tierClass,
                        )}
                      >
                        {cult.name}
                      </span>
                      {cult.quality && (
                        <span
                          className={cn(
                            'border border-current/20 bg-current/5 px-1.5 py-0.5 text-[10px] font-medium',
                            tierClass,
                          )}
                        >
                          {cult.quality}
                        </span>
                      )}
                    </div>
                    {cult.description && (
                      <div className="text-ink-secondary/80 border-ink/5 group-hover:border-ink/20 border-l-2 pl-3 text-justify text-sm leading-relaxed transition-colors">
                        {cult.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
