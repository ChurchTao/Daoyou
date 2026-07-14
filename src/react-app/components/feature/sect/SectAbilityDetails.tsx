import type { LingxiaoAbilityDetail } from '@shared/engine/sect';

function formatCoefficient(value: number | undefined) {
  return value === undefined
    ? null
    : `${value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}物攻`;
}

function DetailRows({ detail }: { detail: LingxiaoAbilityDetail }) {
  const effect = detail.effect;
  const rows = [
    detail.manaWeight > 0 ? `法力：${detail.manaCost}` : '法力：不消耗',
    `冷却：${detail.cooldown}回合`,
    effect.damageCoefficient !== undefined
      ? `伤害：${effect.hits ?? 1}段 × ${formatCoefficient(effect.damageCoefficient)}`
      : null,
    effect.momentumDamageCoefficient !== undefined
      ? `剑势增伤：每点剑势追加${formatCoefficient(effect.momentumDamageCoefficient)}`
      : null,
    effect.lowHpBonusCoefficient !== undefined
      ? `追命：目标低于25%气血时追加${formatCoefficient(effect.lowHpBonusCoefficient)}`
      : null,
    effect.counterCoefficient !== undefined ? `反击：${formatCoefficient(effect.counterCoefficient)}` : null,
    effect.shieldCoefficient !== undefined ? `护盾：${formatCoefficient(effect.shieldCoefficient)}` : null,
    effect.momentumGain ? `剑势：获得${effect.momentumGain}点` : null,
    effect.momentumRequired ? `释放：至少${effect.momentumRequired}点剑势` : null,
    effect.consumesAllMomentum ? '释放后：消耗全部剑势' : null,
    effect.swordMarkLayers ? `剑痕：施加${effect.swordMarkLayers}层` : null,
    effect.swordMarkDamageCoefficient !== undefined
      ? `剑痕附伤：每层${formatCoefficient(effect.swordMarkDamageCoefficient)}，无视防御`
      : null,
    effect.consumesSwordMarks ? '剑痕：消费目标全部剑痕' : null,
    effect.speedBonus ? `身法：下一回合提高${Math.round(effect.speedBonus * 100)}%` : null,
    effect.forcedCritical ? '特殊：本次攻击强制暴击' : null,
  ].filter((row): row is string => Boolean(row));

  return (
    <>
      <div className="grid gap-1 md:grid-cols-2">
        {rows.map((row) => <p key={row}>{row}</p>)}
      </div>
      {detail.notes.length ? (
        <div className="text-ink-secondary mt-2 space-y-1">
          {detail.notes.map((note) => <p key={note}>{note}</p>)}
        </div>
      ) : null}
    </>
  );
}

export function SectAbilityDetails({
  detail,
  collapsible = true,
}: {
  detail: LingxiaoAbilityDetail;
  collapsible?: boolean;
}) {
  if (!collapsible) {
    return <div className="border-ink/15 mt-3 border-t border-dashed pt-2 text-sm"><DetailRows detail={detail} /></div>;
  }

  return (
    <details className="border-ink/15 mt-3 border-t border-dashed pt-2 text-sm">
      <summary className="text-ink-secondary hover:text-ink cursor-pointer">查看详情</summary>
      <div className="mt-2"><DetailRows detail={detail} /></div>
    </details>
  );
}
