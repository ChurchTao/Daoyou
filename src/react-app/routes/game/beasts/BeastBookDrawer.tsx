import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { InkModal } from '@app/components/layout/InkModal';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { beastSkillPresentation } from '@shared/combat-v6/beast-skill-presentation';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import type { InventoryView } from '@shared/contracts/inventory';
import { BAG_CAPACITY, itemDefinition } from '@shared/inventory';
import { useEffect, useRef, useState } from 'react';

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
  const bagQuery = useInventoryBag();
  const inventory = bagQuery.data;
  const [roster, setData] = useState<BeastManagementView>();
  const unavailable = !inventory || bagQuery.isRefreshing || !!bagQuery.error;
  const [selectedId, setSelectedId] = useState<string>();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const busy = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifetime.current = controller;
    void combatV6Request<BeastManagementView>('/api/combat-v6/beasts', {
      signal: controller.signal,
    })
      .then((roster) => {
        if (!controller.signal.aborted) setData(roster);
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
  const beast = roster?.beasts.find((entry) => entry.id === beastId);
  const selected = inventory?.items.find((item) => item.id === selectedId);
  function bookReason(item: InventoryView['items'][number]) {
    const definition = itemDefinition(item.definitionId);
    if (definition.kind !== 'beast_book') return '此物品不是兽诀。';
    if (!definition.skillId) return '此兽诀已无法学习。';
    if (!beast || !roster) return '正在核对灵兽状态。';
    if (!beast.skillSlotCapacity) return '此灵兽没有可用技能格。';
    if (beast.level > roster.ownerLevel) return '灵兽战斗等级高于人物等级。';
    if (beast.skills.includes(definition.skillId!)) return '灵兽已拥有此技能。';
    return '';
  }
  const valid = !unavailable && !!selected && !bookReason(selected);
  async function learn() {
    if (busy.current || unavailable || !valid || !confirming) return;
    busy.current = true;
    setPending(true);
    const signal = lifetime.current!.signal;
    try {
      const result = await consumeResourceMutation<{
        oldSkill?: string;
        newSkill: string;
      }>(
        await fetch('/api/combat-v6/inventory', {
          ...mutationBody({
            action: 'learn',
            id: selected!.id,
            revision: selected!.revision,
            beastId,
            beastRevision: beast!.revision,
          }),
          signal,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      if (signal.aborted) return;
      pushToast({
        message: result.oldSkill
          ? `${beastSkillPresentation(result.oldSkill).name} → ${beastSkillPresentation(result.newSkill).name}`
          : `已学会${beastSkillPresentation(result.newSkill).name}`,
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
      bagQuery.invalidate();
      if (!signal.aborted)
        pushToast({
          message: e instanceof Error ? e.message : '操作失败',
          tone: 'danger',
        });
    } finally {
      busy.current = false;
      if (!signal.aborted) {
        setPending(false);
        setConfirming(false);
        setSelectedId(undefined);
        setData(undefined);
        setRefresh((value) => value + 1);
      }
    }
  }
  return (
    <>
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
                onClick={() => setConfirming(true)}
              >
                学习兽诀
              </InkButton>
            </div>
          ) : null
        }
        onClose={() => {
          if (!busy.current && !confirming) close();
        }}
      >
        <div className="space-y-4 text-sm">
          <InkButton
            disabled={pending}
            onClick={() => {
              void bagQuery.reload();
              setData(undefined);
              setSelectedId(undefined);
              setRefresh((value) => value + 1);
            }}
          >
            刷新兽诀
          </InkButton>
          {bagQuery.error ? <p role="alert">{bagQuery.error}</p> : null}
          {roster && inventory ? (
            <>
              <div className="text-ink-secondary flex justify-between text-xs">
                <span>储物袋 · 选择兽诀</span>
                <span className="font-mono">
                  {inventory.used} / {BAG_CAPACITY}
                </span>
              </div>
              <InventoryItems
                items={inventory.items}
                slotProps={(item) => {
                  const reason = item ? bookReason(item) : '';
                  const book = !!item && !reason;
                  return {
                    selected: !!item && selectedId === item.id,
                    disabled: pending || unavailable,
                    badge: book ? '可选' : undefined,
                    onQuickAction: book
                      ? () => setSelectedId(item.id)
                      : undefined,
                    children: item
                      ? (hide) =>
                          book ? (
                            <InkButton
                              disabled={pending || unavailable}
                              onClick={() => {
                                setSelectedId(item.id);
                                hide();
                              }}
                            >
                              选择此兽诀
                            </InkButton>
                          ) : (
                            <p className="text-ink-secondary">{reason}</p>
                          )
                      : undefined,
                  };
                }}
              />
            </>
          ) : (
            <p>正在读取兽诀……</p>
          )}
          {inventory &&
          !inventory.items.some(
            (item) => itemDefinition(item.definitionId).kind === 'beast_book',
          ) ? (
            <p className="text-ink-secondary">储物袋中暂无兽诀</p>
          ) : null}
        </div>
      </InkDetailDrawer>
      <InkModal
        isOpen={confirming}
        title="确认学习兽诀"
        onClose={() => {
          if (!busy.current) setConfirming(false);
        }}
        footer={
          <div className="flex justify-end gap-3">
            <InkButton disabled={pending} onClick={() => setConfirming(false)}>
              取消
            </InkButton>
            <InkButton
              pending={pending}
              disabled={!valid}
              onClick={() => void learn()}
            >
              确认学习
            </InkButton>
          </div>
        }
      >
        <p className="text-sm">
          为{beast?.name}学习将消耗一本
          {selected ? itemDefinition(selected.definitionId).name : '兽诀'}，
          随机替换该灵兽已有技能中的一个，结果不可撤销。确定学习吗？
        </p>
      </InkModal>
    </>
  );
}
