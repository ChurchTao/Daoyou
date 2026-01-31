import { tierColorMap, type Tier } from '@/components/ui/InkBadge';
import { cn } from '@/lib/cn';
import type { Artifact, Attributes, Cultivator } from '@/types/cultivator';
import { getEquipmentSlotInfo } from '@/types/dictionaries';

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
      <div className="bg-ink/4 group-hover:bg-ink/[0.07] flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors">
        {icon}
      </div>
      <h4 className="text-ink-primary text-lg font-bold tracking-wide">
        {title}
      </h4>
      <div className="from-ink/10 ml-2 h-px flex-1 bg-linear-to-r to-transparent" />
    </div>
  );

  // 格式化单个属性：基础 → 最终
  const formatAttr = (label: string, base: number, final: number) => {
    const isModified = base !== final;
    return (
      <div className="bg-ink/3 hover:bg-ink/6 flex flex-col gap-1 rounded-md p-3 transition-all hover:-translate-y-px">
        <span className="text-ink-secondary text-xs tracking-widest opacity-70">
          {label}
        </span>
        <div className="flex items-baseline gap-2">
          <span className="text-ink-primary text-lg font-bold">{final}</span>
          {isModified && (
            <div className="flex items-center gap-1 text-[10px]">
              <span className="line-through opacity-40">{base}</span>
              <span className="text-crimson bg-crimson/5 rounded-sm px-1 font-medium">
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
        <div className="bg-ink/2 flex items-center gap-4 rounded-lg p-3 opacity-40 grayscale">
          <div className="bg-ink/5 flex h-10 w-10 items-center justify-center rounded-full text-xl">
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
      <div className="bg-ink/3 group hover:bg-ink/6 rounded-lg p-4 transition-all">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-ink/5 flex h-10 w-10 items-center justify-center rounded-full text-xl transition-transform group-hover:scale-110">
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
                      'rounded bg-current/5 px-1.5 py-0.5 text-[10px] font-medium uppercase',
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
                  className="bg-ink/3 flex min-w-20 flex-col gap-1 rounded-md p-3"
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
              const tierClass = fate.quality
                ? tierColorMap[fate.quality as Tier]
                : '';
              return (
                <div
                  key={fate.name + idx}
                  className="bg-ink/3 group hover:bg-ink/6 rounded-lg p-4 transition-colors"
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
                          'rounded bg-current/5 px-1.5 py-0.5 text-[10px] font-medium',
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
                const tierClass = skill.grade
                  ? tierColorMap[skill.grade as Tier]
                  : '';
                return (
                  <div
                    key={skill.id || skill.name + idx}
                    className="bg-ink/3 group hover:bg-ink/6 rounded-lg p-4 transition-all"
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
                      {skill.grade && (
                        <span
                          className={cn(
                            'rounded bg-current/5 px-1.5 py-0.5 text-[10px] font-medium',
                            tierClass,
                          )}
                        >
                          {skill.grade}
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
                const tierClass = cult.grade
                  ? tierColorMap[cult.grade as Tier]
                  : '';
                return (
                  <div
                    key={cult.name + idx}
                    className="bg-ink/3 group hover:bg-ink/6 rounded-lg p-4 transition-all"
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
                      {cult.grade && (
                        <span
                          className={cn(
                            'rounded bg-current/5 px-1.5 py-0.5 text-[10px] font-medium',
                            tierClass,
                          )}
                        >
                          {cult.grade}
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
