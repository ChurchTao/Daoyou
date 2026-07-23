import { InkModal } from '@app/components/layout/InkModal';
import type {
  AttrsStateView,
  UnitStateSnapshot,
} from '@shared/engine/battle-v5/systems/state/types';
import { cn } from '@shared/lib/cn';
import {
  getAttributeInfo,
  getGameConceptLabel,
  getGameConceptVariantLabel,
  getResourceText,
} from '@shared/lib/gameConceptDisplay';
import { format } from 'd3-format';
import { isPlayerVisibleBuff } from './combatStatusPresentation';

interface Props {
  unit: UnitStateSnapshot | null;
  isOpen: boolean;
  onClose: () => void;
}

const fmtInt = format(',d');
const fmtPct = format('.1f');

const ATTR_LABELS: Partial<Record<keyof AttrsStateView, string>> = {
  spirit: getAttributeInfo('spirit').label,
  vitality: getAttributeInfo('vitality').label,
  speed: getAttributeInfo('speed').label,
  willpower: getAttributeInfo('willpower').label,
  wisdom: getAttributeInfo('wisdom').label,
  atk: getGameConceptLabel('attribute_atk'),
  def: getGameConceptLabel('attribute_def'),
  magicAtk: getGameConceptLabel('attribute_magic_atk'),
  magicDef: getGameConceptLabel('attribute_magic_def'),
  critRate: getGameConceptLabel('attribute_crit_rate'),
  critDamageMult: getGameConceptLabel('attribute_crit_damage'),
  evasionRate: getGameConceptLabel('attribute_evasion_rate'),
  controlHit: getGameConceptLabel('attribute_control_hit'),
  controlResistance: getGameConceptLabel('attribute_control_resistance'),
  armorPenetration: getGameConceptVariantLabel(
    'attribute_armor_penetration',
    'detailed',
  ),
  magicPenetration: getGameConceptLabel('attribute_magic_penetration'),
  critResist: getGameConceptVariantLabel('attribute_crit_resist', 'detailed'),
  critDamageReduction: getGameConceptVariantLabel(
    'attribute_crit_damage_reduction',
    'detailed',
  ),
  accuracy: getGameConceptVariantLabel('attribute_accuracy', 'detailed'),
  healAmplify: getGameConceptVariantLabel('attribute_heal_amplify', 'detailed'),
  maxHp: getResourceText('maxHp'),
  maxMp: getResourceText('maxMp'),
};

function formatBuffLabel(buff: UnitStateSnapshot['buffs'][number]) {
  const layers = buff.layers > 1 ? ` x${buff.layers}` : '';
  const duration =
    buff.remaining === -1 ? '常驻' : `余${buff.remaining}次自身行动`;
  return `${buff.name}${layers} · ${duration}`;
}

function getBuffToneClass(buff: UnitStateSnapshot['buffs'][number]) {
  if (buff.type === 'debuff' || buff.type === 'control') return 'text-crimson';
  return 'text-teal';
}

export function CombatAttributeModal({ unit, isOpen, onClose }: Props) {
  if (!unit) return null;

  const visibleBuffs = unit.buffs.filter(isPlayerVisibleBuff);

  const renderAttr = (key: keyof AttrsStateView, isPercentage = false) => {
    const finalVal = unit.attrs[key] || 0;
    const baseVal = unit.baseAttrs[key] || 0;
    const modifier = finalVal - baseVal;

    const displayBase = isPercentage ? fmtPct(baseVal * 100) : fmtInt(baseVal);
    const displayMod = isPercentage ? fmtPct(modifier * 100) : fmtInt(modifier);

    return (
      <div
        key={key}
        className="border-battle-faint flex items-baseline justify-between gap-4 border-b border-dashed py-1.5 text-sm last:border-b-0"
      >
        <span className="text-battle-muted">{ATTR_LABELS[key] || key}</span>
        <div className="text-ink flex items-baseline gap-1 font-mono">
          <span>
            {displayBase}
            {isPercentage && '%'}
          </span>
          {Math.abs(modifier) > 0.001 && (
            <span className={cn(modifier > 0 ? 'text-teal' : 'text-crimson')}>
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
          <p className="battle-caption mb-2 text-xs">行动状态</p>
          <div className="space-y-2 py-2 text-sm leading-6">
            {(unit.actionStates ?? []).length > 0 ? (
              (unit.actionStates ?? []).map((state) => (
                <div
                  key={`${state.type}:${state.ability?.id ?? state.name}`}
                  className="space-y-0.5"
                >
                  <div className="text-teal font-medium">
                    {state.type === 'rest'
                      ? `调息 · 余${state.remainingActions}次行动`
                      : `蓄势 · ${state.ability?.name ?? state.name}`}
                  </div>
                  <p className="text-battle-muted text-xs leading-5">
                    {state.type === 'rest'
                      ? `来源：${state.sourceAbility?.name ?? '战斗效果'}；下一次自身行动跳过。`
                      : `来源：${state.sourceAbility?.name ?? '战斗效果'}；下一次自身行动发动${state.ability?.name ?? '后发神通'}。`}
                  </p>
                </div>
              ))
            ) : (
              <span className="text-battle-muted">无行动状态</span>
            )}
          </div>
        </section>

        <section>
          <p className="battle-caption mb-2 text-xs">状态效果</p>
          <div className="space-y-2 py-2 text-sm leading-6">
            {visibleBuffs.length > 0 ? (
              visibleBuffs.map((buff, index) => (
                <div key={`${buff.id}:${index}`} className="space-y-0.5">
                  <div className={cn('font-medium', getBuffToneClass(buff))}>
                    {formatBuffLabel(buff)}
                  </div>
                  {buff.description ? (
                    <p className="text-battle-muted text-xs leading-5">
                      {buff.description}
                    </p>
                  ) : null}
                </div>
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
