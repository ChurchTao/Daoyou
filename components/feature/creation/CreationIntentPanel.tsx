'use client';

import { InkInput } from '@/components/ui';
import {
  EQUIPMENT_SLOT_VALUES,
  type EquipmentSlot,
} from '@/types/constants';

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: '武器',
  armor: '护甲',
  accessory: '配饰',
};

export interface CreationIntentPanelProps {
  productType: 'artifact' | 'skill' | 'gongfa';
  userPrompt: string;
  onUserPromptChange: (value: string) => void;
  /** 仅炼器需要：玩家可声明目标槽位。其它产物传了也会被忽略。 */
  requestedSlot?: EquipmentSlot | '';
  onRequestedSlotChange?: (value: EquipmentSlot | '') => void;
  disabled?: boolean;
}

/**
 * 玩家造物意图面板。
 *
 * 只暴露“玩家真正需要主动决定”的输入：
 *   - userPrompt：命名/风格意念，会传入 LLM 命名阶段做意向融合；
 *   - requestedSlot：仅法宝有意义的装备槽位。
 *
 * 元素倾向 / 语义标签 一律交由材料和引擎自动推演；
 * LLM 命名增强固定开启（遇到错误会自动降级到规则命名）。
 */
export function CreationIntentPanel({
  productType,
  userPrompt,
  onUserPromptChange,
  requestedSlot,
  onRequestedSlotChange,
  disabled,
}: CreationIntentPanelProps) {
  return (
    <div className="space-y-3">
      <InkInput
        label="玩家意念（可选）"
        placeholder="比如：以雷火共鸣的杀伐神通 / 走守御为主的护体功法"
        value={userPrompt}
        onChange={(val) => onUserPromptChange(val)}
        multiline
        rows={3}
        hint="会一并递交给 LLM 命名模型，影响产物名称与风格描述；不会改变核心数值。"
        disabled={disabled}
      />

      {productType === 'artifact' && onRequestedSlotChange && (
        <label className="flex flex-col gap-1">
          <span className="font-semibold tracking-wide">目标槽位（可选）</span>
          <select
            className="border-ink/20 focus:border-crimson border bg-transparent px-3 py-3 text-base focus:outline-none"
            value={requestedSlot ?? ''}
            onChange={(e) =>
              onRequestedSlotChange(
                (e.target.value as EquipmentSlot | '') || '',
              )
            }
            disabled={disabled}
          >
            <option value="">由材料自然决定</option>
            {EQUIPMENT_SLOT_VALUES.map((slot) => (
              <option key={slot} value={slot}>
                {SLOT_LABELS[slot]}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
