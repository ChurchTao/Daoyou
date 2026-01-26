import type { Attributes, Cultivator } from '@/types/cultivator';
import { getEquipmentSlotInfo } from '@/types/dictionaries';
import type { Artifact } from '@/types/cultivator';

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

  // 格式化单个属性：基础 → 最终
  const formatAttr = (label: string, base: number, final: number) => {
    if (base === final) {
      return (
        <div className="flex justify-between items-center text-sm p-2 bg-ink/5 rounded">
          <span className="opacity-70">{label}</span>
          <span>{base}</span>
        </div>
      );
    }
    return (
      <div className="flex justify-between items-center text-sm p-2 bg-ink/5 rounded">
        <span className="opacity-70">{label}</span>
        <span>
          {base} <span className="opacity-50">→</span>{' '}
          <span className="text-crimson font-bold">{final}</span>
        </span>
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
        <div className="flex items-center gap-2 text-sm bg-ink/5 rounded px-2 py-1 border border-ink/10">
          <span className="w-4">{slotInfo.icon}</span>
          <span className="opacity-50 ml-2">未佩戴{slotInfo.label}</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-sm bg-ink/5 rounded px-2 py-1 border border-ink/10">
        <span className="w-4">{slotInfo.icon}</span>
        <span className="font-medium">{item.name}</span>
        <span className="text-xs text-ink-secondary">
          {item.element} · {slotInfo.label}
        </span>
      </div>
    );
  };

  const weapon = getEquippedArtifact(target.equipped.weapon);
  const armor = getEquippedArtifact(target.equipped.armor);
  const accessory = getEquippedArtifact(target.equipped.accessory);

  return (
    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
      {/* 属性面板 */}
      <div>
        <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
          基础属性
        </div>
        <div className="grid grid-cols-2 gap-2">
          {formatAttr(
            '体魄',
            target.attributes.vitality,
            finalAttrs.vitality,
          )}
          {formatAttr('灵力', target.attributes.spirit, finalAttrs.spirit)}
          {formatAttr('悟性', target.attributes.wisdom, finalAttrs.wisdom)}
          {formatAttr('速度', target.attributes.speed, finalAttrs.speed)}
          {formatAttr(
            '神识',
            target.attributes.willpower,
            finalAttrs.willpower,
          )}
        </div>
      </div>

      {/* 装备 */}
      <div>
        <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
          佩戴法宝
        </div>
        <div className="space-y-1">
          {renderEquipmentItem('weapon', weapon)}
          {renderEquipmentItem('armor', armor)}
          {renderEquipmentItem('accessory', accessory)}
        </div>
      </div>

      {/* 灵根 */}
      {target.spiritual_roots && target.spiritual_roots.length > 0 && (
        <div>
          <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
            灵根天赋
          </div>
          <div className="flex flex-wrap gap-2">
            {target.spiritual_roots.map((root, idx) => (
              <span
                key={`${root.element}-${idx}`}
                className="text-sm bg-ink/5 rounded px-2 py-1 border border-ink/10"
              >
                {root.element} · {root.strength}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 先天命格 */}
      {target.pre_heaven_fates && target.pre_heaven_fates.length > 0 && (
        <div>
          <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
            先天命格
          </div>
          <div className="flex flex-wrap gap-2">
            {target.pre_heaven_fates.map((fate, idx) => (
              <span
                key={fate.name + idx}
                className="text-sm bg-ink/5 rounded px-2 py-1 border border-ink/10"
              >
                {fate.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 功法与神通 */}
      <div className="space-y-3">
        {target.skills && target.skills.length > 0 && (
          <div>
            <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
              所修神通
            </div>
            <div className="space-y-1">
              {target.skills.map((skill, idx) => (
                <div
                  key={skill.id || skill.name + idx}
                  className="text-sm bg-ink/5 rounded px-2 py-1 border border-ink/10"
                >
                  {skill.name} · {skill.element}
                </div>
              ))}
            </div>
          </div>
        )}

        {target.cultivations && target.cultivations.length > 0 && (
          <div>
            <div className="text-xs font-bold opacity-50 mb-2 uppercase tracking-wider">
              修炼功法
            </div>
            <div className="space-y-1">
              {target.cultivations.map((cult, idx) => (
                <div
                  key={cult.name + idx}
                  className="text-sm bg-ink/5 rounded px-2 py-1 border border-ink/10"
                >
                  {cult.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
