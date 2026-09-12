import { equipmentRealm } from '@shared/engine/combat-v6/equipment/realm';
import {
  DAO_EQUIPMENT_ARTS_V1,
  DAO_EQUIPMENT_ESSENCES_V1,
} from '@shared/engine/combat-v6/equipment/special-content';
import {
  EQUIPMENT_ATTRIBUTE_NAMES,
  InventoryEquipmentSchema,
} from '@shared/inventory/equipment';

export function EquipmentDetails({
  data,
  previous,
}: {
  data: unknown;
  previous?: unknown;
}) {
  const equipment = InventoryEquipmentSchema.parse(data);
  const old = previous ? InventoryEquipmentSchema.parse(previous) : undefined;
  return (
    <div className="space-y-3 text-sm">
      <p>御使境界 {equipmentRealm(equipment.equipmentLevel).realm}初期</p>
      {(['baseStats', 'attributeBonuses'] as const).map((key) => (
        <div key={key}>
          <p className="text-ink-secondary">
            {key === 'baseStats' ? '器胚' : '附灵'}
          </p>
          <dl className="grid grid-cols-2 gap-2">
            {equipment[key].map((roll) => (
              <div key={roll.attr}>
                <dt>{EQUIPMENT_ATTRIBUTE_NAMES[roll.attr]}</dt>
                <dd className="font-mono">
                  +{roll.value}
                  {old ? (
                    <span className="text-ink-secondary ml-2">
                      （较当前{' '}
                      {roll.value -
                        (old[key].find((r) => r.attr === roll.attr)?.value ??
                          0) >=
                      0
                        ? '+'
                        : ''}
                      {roll.value -
                        (old[key].find((r) => r.attr === roll.attr)?.value ??
                          0)}
                      ）
                    </span>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
          {key === 'attributeBonuses' && equipment.attributeBonuses.length === 2 ? (
            <p>双加合计 <span className="font-mono">{equipment.attributeBonuses.reduce((sum, roll) => sum + roll.value, 0)}</span></p>
          ) : null}
          {!equipment[key].length ? <p>无</p> : null}
          {old?.[key]
            .filter((r) => !equipment[key].some((n) => n.attr === r.attr))
            .map((r) => (
              <p key={r.attr}>
                失去 {EQUIPMENT_ATTRIBUTE_NAMES[r.attr]} +{r.value}
              </p>
            ))}
        </div>
      ))}
      <p>
        器蕴：
        {equipment.essenceIds
          .map(
            (id) =>
              DAO_EQUIPMENT_ESSENCES_V1.find((e) => e.id === id)?.name ?? id,
          )
          .join('、') || '无'}
      </p>
      <p>
        器诀：
        {DAO_EQUIPMENT_ARTS_V1.find((e) => e.id === equipment.artId)?.name ??
          '无'}
      </p>
      {old ? (
        <p className="text-ink-secondary">
          当前器蕴：
          {old.essenceIds
            .map(
              (id) =>
                DAO_EQUIPMENT_ESSENCES_V1.find((e) => e.id === id)?.name ?? id,
            )
            .join('、') || '无'}
          ；器诀：
          {DAO_EQUIPMENT_ARTS_V1.find((e) => e.id === old.artId)?.name ?? '无'}
          。以上为道装属性比较，非人物最终面板。
        </p>
      ) : null}
    </div>
  );
}
