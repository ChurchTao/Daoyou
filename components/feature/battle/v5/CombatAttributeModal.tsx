'use client';

import { cn } from '@/lib/cn';
import type { UnitStateSnapshot, AttrsStateView } from '@/engine/battle-v5/systems/state/types';
import { X } from 'lucide-react';

interface Props {
  unit: UnitStateSnapshot | null;
  isOpen: boolean;
  onClose: () => void;
}

const ATTR_LABELS: Partial<Record<keyof AttrsStateView, string>> = {
  spirit: '灵力 (主)',
  vitality: '体魄 (主)',
  speed: '身法 (主)',
  willpower: '神识 (主)',
  wisdom: '悟性 (主)',
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
 * 详细属性弹窗
 */
export function CombatAttributeModal({ unit, isOpen, onClose }: Props) {
  if (!isOpen || !unit) return null;

  const renderAttr = (key: keyof AttrsStateView, isPercentage = false) => {
    const val = unit.attrs[key];
    const label = ATTR_LABELS[key] || key;
    let displayVal = val.toString();
    
    if (isPercentage) {
      displayVal = `${(val * 100).toFixed(1)}%`;
    } else if (typeof val === 'number') {
      displayVal = Math.round(val).toString();
    }

    return (
      <div key={key} className="flex justify-between py-1 border-b border-ink/5 text-sm">
        <span className="text-ink/60">{label}</span>
        <span className="font-mono text-ink">{displayVal}</span>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-paper border-2 border-ink w-full max-w-md shadow-2xl relative animate-scale-in">
        {/* 头部 */}
        <div className="bg-ink text-paper px-4 py-3 flex justify-between items-center">
          <h3 className="font-heading text-lg">角色详细属性 - {unit.name}</h3>
          <button onClick={onClose} className="hover:rotate-90 transition-transform">
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {/* 左侧：基础 5 维 */}
            <div>
              <h4 className="font-heading text-ink border-b border-ink/20 mb-2 pb-1 text-sm uppercase">基础五维</h4>
              {renderAttr('spirit')}
              {renderAttr('vitality')}
              {renderAttr('speed')}
              {renderAttr('willpower')}
              {renderAttr('wisdom')}
            </div>

            {/* 右侧：关键二级属性 */}
            <div>
              <h4 className="font-heading text-ink border-b border-ink/20 mb-2 pb-1 text-sm uppercase">战斗属性</h4>
              {renderAttr('atk')}
              {renderAttr('magicAtk')}
              {renderAttr('def')}
              {renderAttr('magicDef')}
              {renderAttr('maxHp')}
              {renderAttr('maxMp')}
            </div>
          </div>

          {/* 下方：高级属性 */}
          <div className="mt-6">
            <h4 className="font-heading text-ink border-b border-ink/20 mb-2 pb-1 text-sm uppercase">派生与进阶</h4>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
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
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-4 border-t border-ink/10 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-1.5 border border-ink text-ink hover:bg-ink hover:text-paper transition-colors font-heading"
          >
            知晓了
          </button>
        </div>
      </div>
    </div>
  );
}
