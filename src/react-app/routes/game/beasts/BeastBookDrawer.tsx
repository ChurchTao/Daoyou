import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { combatV6SkillDetails } from '@shared/combat-v6/skill-details';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import type { InventoryView } from '@shared/contracts/inventory';
import {
  BEAST_SKILLS,
  activeBeastSkills,
} from '@shared/engine/combat-v6/beasts';
import { BAG_CAPACITY, itemDefinition } from '@shared/inventory';
import { useEffect, useRef, useState } from 'react';

const details = combatV6SkillDetails(BEAST_SKILLS, []);
const skillName = (id: string) =>
  BEAST_SKILLS.find((skill) => skill.id === id)?.name ?? id;

export function BeastBookDrawer({
  beastId,
  close,
  onUpdate,
}: {
  beastId: string;
  close: () => void;
  onUpdate: (view: BeastManagementView) => void;
}) {
  const { pushToast } = useInkUI();
  const [data, setData] = useState<{
    inventory: InventoryView;
    roster: BeastManagementView;
  }>();
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void Promise.all([
      combatV6Request<InventoryView>('/api/combat-v6/inventory?location=bag', {
        signal: controller.signal,
      }),
      combatV6Request<BeastManagementView>('/api/combat-v6/beasts', {
        signal: controller.signal,
      }),
    ])
      .then(([inventory, roster]) => {
        if (!controller.signal.aborted) setData({ inventory, roster });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          pushToast({
            message: e instanceof Error ? e.message : '读取失败',
            tone: 'danger',
          });
      });
    return () => controller.abort();
  }, [refresh, pushToast]);
  const beast = data?.roster.beasts.find((entry) => entry.id === beastId);
  const selected = data?.inventory.items.find((item) => item.id === selectedId);
  const valid =
    !!beast &&
    !!selected &&
    itemDefinition(selected.definitionId).kind === 'beast_book' &&
    beast.skillSlotCapacity > 0 &&
    beast.level <= data!.roster.ownerLevel &&
    !beast.skills.includes(itemDefinition(selected.definitionId).skillId!);
  async function learn() {
    if (busy.current || !valid) return;
    busy.current = true;
    setPending(true);
    const signal = lifetime.current!.signal;
    try {
      const result = await combatV6Request<{
        oldSkill?: string;
        newSkill: string;
      }>('/api/combat-v6/inventory', {
        ...mutationBody({
          action: 'learn',
          id: selected!.id,
          revision: selected!.revision,
          beastId,
          beastRevision: beast!.revision,
        }),
        signal,
      });
      if (signal.aborted) return;
      pushToast({
        message: result.oldSkill
          ? `${skillName(result.oldSkill)} → ${skillName(result.newSkill)}`
          : `已学会${skillName(result.newSkill)}`,
        tone: 'success',
      });
      const roster = await combatV6Request<BeastManagementView>(
        '/api/combat-v6/beasts',
        { signal },
      );
      if (!signal.aborted) {
        onUpdate(roster);
        close();
      }
    } catch (e) {
      if (!signal.aborted)
        pushToast({
          message: e instanceof Error ? e.message : '操作失败',
          tone: 'danger',
        });
    } finally {
      busy.current = false;
      if (!signal.aborted) {
        setPending(false);
        setSelectedId(undefined);
        setData(undefined);
        setRefresh((value) => value + 1);
      }
    }
  }
  return (
    <InkDetailDrawer
      isOpen
      title={`${beast?.name ?? '灵兽'} · 学习兽诀`}
      size="md"
      footer={
        selected ? (
          <div className="space-y-2 text-sm">
            <p>
              消耗一本{itemDefinition(selected.definitionId).name}
              ，随机覆盖一个已有技能，结果不可撤销。
            </p>
            {!valid ? (
              <p className="text-ink-secondary">
                灵兽需有技能格、战斗等级不高于人物等级，且尚未拥有此技能。
              </p>
            ) : null}
            <InkButton
              pending={pending}
              disabled={!valid}
              onClick={() => void learn()}
            >
              确认学习
            </InkButton>
          </div>
        ) : null
      }
      onClose={() => {
        if (!busy.current) close();
      }}
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-3">
          {beast?.skills.map((id) => (
            <span key={id}>
              {skillName(id)}
              {!activeBeastSkills(beast).includes(id)
                ? '（被高级技能抑制）'
                : ''}
              <InkTooltip label="技能说明">
                {details[id]?.description}
              </InkTooltip>
            </span>
          ))}
        </div>
        <InkButton
          disabled={pending}
          onClick={() => {
            setData(undefined);
            setSelectedId(undefined);
            setRefresh((value) => value + 1);
          }}
        >
          刷新兽诀
        </InkButton>
        {data ? (
          <>
            <div className="text-ink-secondary flex justify-between text-xs">
              <span>储物袋 · 选择兽诀</span>
              <span className="font-mono">
                {data.inventory.used} / {BAG_CAPACITY}
              </span>
            </div>
            <InventoryItems
              items={data.inventory.items}
              slotProps={(item) => {
                const book =
                  !!item &&
                  itemDefinition(item.definitionId).kind === 'beast_book';
                return {
                  selected: !!item && selectedId === item.id,
                  disabled: pending || !book,
                  className: item && !book ? 'opacity-35' : undefined,
                  onQuickAction: book
                    ? () => setSelectedId(item.id)
                    : undefined,
                  children: item
                    ? (hide) =>
                        book ? (
                          <InkButton
                            disabled={pending}
                            onClick={() => {
                              setSelectedId(item.id);
                              hide();
                            }}
                          >
                            选择此兽诀
                          </InkButton>
                        ) : (
                          <p className="text-ink-secondary">
                            请选择兽诀用于学习。
                          </p>
                        )
                    : undefined,
                };
              }}
            />
          </>
        ) : (
          <p>正在读取兽诀……</p>
        )}
        {data &&
        !data.inventory.items.some(
          (item) => itemDefinition(item.definitionId).kind === 'beast_book',
        ) ? (
          <p className="text-ink-secondary">储物袋中暂无兽诀</p>
        ) : null}
      </div>
    </InkDetailDrawer>
  );
}
