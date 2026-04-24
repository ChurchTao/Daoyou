'use client';

import { cn } from '@/lib/cn';
import type {
  AttrsStateView,
  UnitStateSnapshot,
} from '@/engine/battle-v5/systems/state/types';
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

function formatBuffLabel(buff: UnitStateSnapshot['buffs'][number]) {
  const layers = buff.layers > 1 ? ` x${buff.layers}` : '';
  const duration = buff.remaining === -1 ? '常驻' : `余${buff.remaining}`;
  return `${buff.name}${layers} · ${duration}`;
}

export function CombatAttributeModal({ unit, isOpen, onClose }: Props) {
  if (!unit) return null;

  const renderAttr = (key: keyof AttrsStateView, isPercentage = false) => {
    const finalVal = unit.attrs[key] || 0;
    const baseVal = unit.baseAttrs[key] || 0;
    const modifier = finalVal - baseVal;

    const displayBase = isPercentage ? fmtPct(baseVal * 100) : fmtInt(baseVal);
    const displayMod = isPercentage ? fmtPct(modifier * 100) : fmtInt(modifier);

    return (
      <div
        key={key}
        className="flex items-baseline justify-between gap-4 border-b border-dashed border-battle-faint py-1.5 text-sm last:border-b-0"
      >
        <span className="text-battle-muted">{ATTR_LABELS[key] || key}</span>
        <div className="text-ink flex items-baseline gap-1 font-mono">
          <span>
            {displayBase}
            {isPercentage && '%'}
          </span>
          {Math.abs(modifier) > 0.001 && (
            <span
              className={cn(
                modifier > 0 ? 'text-teal' : 'text-crimson',
              )}
            >
              {modifier > 0 ? '+' : ''}
              {displayMod}
              {isPercentage && '%'}
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
      title={`详细属性 · ${unit.name}`}
      className="battle-modal-panel max-w-2xl"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <section>
            <p className="battle-caption mb-2 text-xs">基础属性</p>
            <div className="py-1">
              {renderAttr('spirit')}
              {renderAttr('vitality')}
              {renderAttr('speed')}
              {renderAttr('willpower')}
              {renderAttr('wisdom')}
            </div>
          </section>

          <section>
            <p className="battle-caption mb-2 text-xs">战斗资源</p>
            <div className="py-1">
              {renderAttr('maxHp')}
              {renderAttr('maxMp')}
              {renderAttr('atk')}
              {renderAttr('magicAtk')}
              {renderAttr('def')}
              {renderAttr('magicDef')}
            </div>
          </section>
        </div>

        <section>
          <p className="battle-caption mb-2 text-xs">详细修正</p>
          <div className="grid grid-cols-1 gap-6 py-1 md:grid-cols-2">
            <div>
              {renderAttr('critRate', true)}
              {renderAttr('critDamageMult', true)}
              {renderAttr('evasionRate', true)}
              {renderAttr('accuracy', true)}
              {renderAttr('controlHit', true)}
              {renderAttr('controlResistance', true)}
            </div>
            <div>
              {renderAttr('armorPenetration', true)}
              {renderAttr('magicPenetration', true)}
              {renderAttr('critResist', true)}
              {renderAttr('critDamageReduction', true)}
              {renderAttr('healAmplify', true)}
            </div>
          </div>
        </section>

        <section>
          <p className="battle-caption mb-2 text-xs">状态效果</p>
          <div className="flex flex-wrap gap-x-1 gap-y-1 py-2 text-sm leading-7">
            {unit.buffs.length > 0 ? (
              unit.buffs.map((buff, index) => (
                <span key={buff.id} className="contents">
                  <span
                    className={cn(
                      buff.type === 'debuff' ? 'text-crimson' : 'text-teal',
                    )}
                  >
                    {formatBuffLabel(buff)}
                  </span>
                  {index < unit.buffs.length - 1 && (
                    <span className="text-battle-muted">｜</span>
                  )}
                </span>
              ))
            ) : (
              <span className="text-battle-muted">无状态</span>
            )}
          </div>
        </section>

        <p className="text-battle-muted text-center text-xs italic">
          点击遮罩或按下 Esc 键即可返回
        </p>
      </div>
    </InkModal>
  );
}
