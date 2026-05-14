import type { AttributeModifierView } from './abilityDisplay';

interface AttributeModifierListProps {
  modifiers: AttributeModifierView[];
}

/**
 * 属性修正（AttributeModifierConfig[]）的列表展示，用在功法 / 法宝详情。
 */
export function AttributeModifierList({ modifiers }: AttributeModifierListProps) {
  if (modifiers.length === 0) return null;

  return (
    <div className="space-y-1.5">
      <h3 className="text-ink-secondary text-xs font-semibold tracking-wide uppercase">
        属性加成
      </h3>
      <ul className="grid grid-cols-2 gap-1.5 text-sm">
        {modifiers.map((mod, i) => (
          <li
            key={`${mod.attrKey}-${i}`}
            className="border-ink/10 flex items-center justify-between rounded-md border px-2 py-1"
          >
            <span className="text-ink-secondary">{mod.attrLabel}</span>
            <span className="text-ink-primary font-medium">{mod.valueText}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
