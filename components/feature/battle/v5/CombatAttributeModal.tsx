'use client';

import { cn } from '@/lib/cn';
import type { UnitStateSnapshot, AttrsStateView } from '@/engine/battle-v5/systems/state/types';
import { InkModal } from '@/components/layout/InkModal';
import { format } from 'd3-format';

interface Props {
  unit: UnitStateSnapshot | null;
  isOpen: boolean;
  onClose: () => void;
}

const fmtInt = format(',d');
const fmtPct = format('.1f');

const ATTR_LABELS: Partial<Record<keyof AttrsStateView, string>> = {
  spirit: '灵力',
  vitality: '体魄',
  speed: '身法',
  willpower: '神识',
  wisdom: '悟性',
  atk: '物理攻击',
  def: '物理防御',
  magicAtk: '法术攻击',
  magicDef: '法术防御',
  critRate: '暴击率',
  critDamageMult: '暴击伤害',
  evasionRate: '闪避率',
  controlHit: '控制命中',
  controlResistance: '控制抗性',
  armorPenetration: '破甲',
  magicPenetration: '法术穿透',
  critResist: '暴击韧性',
  critDamageReduction: '暴击减伤',
  accuracy: '精准',
  healAmplify: '治疗增强',
  maxHp: '气血上限',
  maxMp: '真元上限',
};

/**
 * 详细属性弹窗 - 使用统一的 InkModal
 */
export function CombatAttributeModal({ unit, isOpen, onClose }: Props) {
  if (!unit) return null;

  const renderAttr = (key: keyof AttrsStateView, isPercentage = false) => {
    const finalVal = unit.attrs[key] || 0;
    const baseVal = unit.baseAttrs[key] || 0;
    const modifier = finalVal - baseVal;
    
    const label = ATTR_LABELS[key] || key;
    
    const displayBase = isPercentage ? fmtPct(baseVal * 100) : fmtInt(baseVal);
    const displayMod = isPercentage ? fmtPct(modifier * 100) : fmtInt(modifier);

    return (
      <div key={key} className="flex justify-between py-1 border-b border-ink/5 text-sm">
        <span className="text-ink/60">{label}</span>
        <div className="font-mono text-ink flex gap-1">
          <span>{displayBase}{isPercentage && '%'}</span>
          {Math.abs(modifier) > 0.001 && (
            <span className={cn(
              "text-[10px] mt-0.5",
              modifier > 0 ? "text-teal-600" : "text-crimson"
            )}>
              {modifier > 0 ? '+' : ''}{displayMod}{isPercentage && '%'}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <InkModal
      isOpen={isOpen}
      onClose={onClose}
      title={`角色属性 · ${unit.name}`}
      className="max-w-lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6 p-2">
        {/* 基础五维 */}
        <section>
          <h4 className="font-heading text-ink border-b border-ink/20 mb-2 pb-1 text-xs opacity-50 uppercase tracking-widest">基础属性</h4>
          {renderAttr('spirit')}
          {renderAttr('vitality')}
          {renderAttr('speed')}
          {renderAttr('willpower')}
          {renderAttr('wisdom')}
        </section>

        {/* 关键二级属性 */}
        <section>
          <h4 className="font-heading text-ink border-b border-ink/20 mb-2 pb-1 text-xs opacity-50 uppercase tracking-widest">战斗资源</h4>
          {renderAttr('maxHp')}
          {renderAttr('maxMp')}
          {renderAttr('atk')}
          {renderAttr('magicAtk')}
          {renderAttr('def')}
          {renderAttr('magicDef')}
        </section>

        {/* 进阶属性 */}
        <section className="sm:col-span-2">
          <h4 className="font-heading text-ink border-b border-ink/20 mb-2 pb-1 text-xs opacity-50 uppercase tracking-widest">详细修正</h4>
          <div className="grid grid-cols-2 gap-x-8">
            {renderAttr('critRate', true)}
            {renderAttr('critDamageMult', true)}
            {renderAttr('evasionRate', true)}
            {renderAttr('accuracy', true)}
            {renderAttr('controlHit', true)}
            {renderAttr('controlResistance', true)}
            {renderAttr('armorPenetration', true)}
            {renderAttr('magicPenetration', true)}
            {renderAttr('critResist', true)}
            {renderAttr('critDamageReduction', true)}
            {renderAttr('healAmplify', true)}
          </div>
        </section>
      </div>

      {/* 底部关闭提示 */}
      <div className="mt-8 pt-4 border-t border-ink/10 flex justify-center">
        <p className="text-[10px] text-ink/30 italic">点击遮罩或按下 Esc 键即可返回</p>
      </div>
    </InkModal>
  );
}
