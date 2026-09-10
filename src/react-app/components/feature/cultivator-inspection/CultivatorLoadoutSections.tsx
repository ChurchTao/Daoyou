import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { InkNotice } from '@app/components/ui';
import type { PublicCombatV6Build } from '@shared/combat-v6/public-build';
import { DAO_EQUIPMENT_SLOTS } from '@shared/engine/combat-v6/equipment';
import { itemDefinition } from '@shared/inventory';
import { EQUIPMENT_SLOT_NAMES } from '@shared/items/definitions/equipment-blueprints';

export function CultivatorLoadoutSections({
  build,
}: {
  build: PublicCombatV6Build | null;
}) {
  if (!build) return <InkNotice>尚未初始化新版构筑</InkNotice>;
  return (
    <div className="space-y-5">
      <p className="text-sm">
        {build.sectName} · {build.pathName}
      </p>
      <section className="space-y-3">
        <h5 className="font-semibold">所御道装</h5>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {DAO_EQUIPMENT_SLOTS.map((slot) => {
            const equipment = build.equipment[slot];
            return (
              <div key={slot} className="space-y-1">
                <ItemSlot
                  className="w-full"
                  emptyLabel="未装备"
                  item={
                    equipment
                      ? {
                          definitionId: 'equipment.v6',
                          name: equipment.name,
                          quantity: 1,
                          instanceData: equipment,
                        }
                      : undefined
                  }
                />
                <p className="text-ink-secondary text-center text-xs">
                  {EQUIPMENT_SLOT_NAMES[slot]}
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <section className="space-y-3">
        <h5 className="font-semibold">已装配功法</h5>
        {build.manuals.length ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {build.manuals.map(({ slot, manualId, level }) => {
              const definition = itemDefinition('jade.' + manualId);
              return (
                <div key={slot}>
                  <ItemSlot
                    className="w-full"
                    item={{
                      definitionId: definition.id,
                      name: definition.name.replace(/玉简$/, ''),
                      quantity: 1,
                      instanceData: null,
                    }}
                  />
                  <p className="text-center text-xs">
                    <span className="font-mono">{level}</span> 层
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <InkNotice>尚未装配功法</InkNotice>
        )}
      </section>
      <section className="space-y-3">
        <h5 className="font-semibold">当前可用技能</h5>
        {build.skills.map((skill) => (
          <details
            key={skill.id}
            className="border-ink/10 border-b pb-2 text-sm"
          >
            <summary className="cursor-pointer">
              {skill.name} · Lv.<span className="font-mono">{skill.level}</span>
            </summary>
            <p className="text-ink-secondary mt-2 leading-6">
              {skill.description}
            </p>
          </details>
        ))}
      </section>
    </div>
  );
}
