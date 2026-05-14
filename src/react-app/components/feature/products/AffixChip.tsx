import type { AffixView } from './abilityDisplay';
import {
  getAffixToneStyle,
  getAffixUnderlineStyle,
  getPerfectMarkStyle,
} from './affixPresentation';

interface AffixChipProps {
  affix: AffixView;
}

/**
 * 词缀 chip：统一在法宝 / 神通 / 功法详情里渲染一条 AffixView。
 *
 * 视觉契约：
 *   - 稀有度 → 文字颜色。
 *   - 词缀标题使用低对比虚线下划线辅助扫读。
 *   - 完美触发 → 「极」作为内嵌小印记附着在词缀标题上，不打断正文对齐。
 */
export function AffixChip({ affix }: AffixChipProps) {
  return (
    <li className="flex items-start text-sm leading-relaxed" data-affix-chip={affix.id}>
      <div className="flex-1">
        <span
          className="relative inline-flex max-w-full border-b border-dashed pr-2 pb-px"
          style={getAffixUnderlineStyle(affix.isPerfect)}
        >
          <span
            className="font-medium"
            style={getAffixToneStyle(affix.rarityTone)}
          >
            {affix.name}
          </span>
          {affix.isPerfect && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-0.5 text-[0.62rem] font-semibold leading-none"
              data-affix-perfect-mark="embedded"
              style={getPerfectMarkStyle()}
            >
              极
            </span>
          )}
        </span>
        <span className="text-ink-secondary">：</span>
        <span className="text-ink-secondary">
          {affix.bodyText}
        </span>
      </div>
    </li>
  );
}
