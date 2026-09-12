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
import { beastRefinementReason } from '@shared/engine/combat-v6/beasts/refinement';
import { BEAST_REFINEMENT } from '@shared/engine/combat-v6/beasts/refinement-config';
import { BAG_CAPACITY, itemDefinition } from '@shared/inventory';
import { useEffect, useRef, useState } from 'react';

export function BeastBookDrawer({
  beastId,
  mode = 'learn',
  close,
  onUpdate,
}: {
  beastId: string;
  mode?: 'learn' | 'refine';
  close: () => void;
  onUpdate: (view: BeastManagementView) => void;
}) {
  const refining = mode === 'refine';
  const actionName = refining ? '洗炼' : '学习兽诀';
  const itemName = refining ? '灵露' : '兽诀';
  const itemKind = refining ? 'beast_refinement' : 'beast_book';
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
    if (refining) {
      if (!beast || !roster) return '正在核对灵兽状态。';
      const dew = BEAST_REFINEMENT.items.find(
        (entry) => entry.id === item.definitionId,
      );
      const reason = beastRefinementReason(
        beast,
        item.definitionId,
        roster.ownerLevel,
      );
      if (reason) return reason;
      if (dew && item.quantity < dew.consumeQuantity) return '灵露数量不足。';
      return '';
    }
    if (definition.kind !== 'beast_book') return '此物品不是兽诀。';
    if (!definition.skillId) return '此兽诀已无法学习。';
    if (!beast || !roster) return '正在核对灵兽状态。';
    if (!beast.skillSlotCapacity) return '此灵兽没有可用技能格。';
    if (beast.level > roster.ownerLevel) return '灵兽战斗等级高于人物等级。';
    if (beast.skills.includes(definition.skillId!)) return '灵兽已拥有此技能。';
    return '';
  }
  const consumeQuantity =
    BEAST_REFINEMENT.items.find((item) => item.id === selected?.definitionId)
      ?.consumeQuantity ?? 1;
  const valid = !unavailable && !!selected && !bookReason(selected);
  async function learn() {
    if (busy.current || unavailable || !valid || !confirming) return;
    busy.current = true;
    setPending(true);
    const signal = lifetime.current!.signal;
    try {
      const result = await consumeResourceMutation<{
        oldSkill?: string;
        newSkill?: string;
        oldSkillCount?: number;
        newSkillCount?: number;
      }>(
        await fetch('/api/combat-v6/inventory', {
          ...mutationBody({
            action: mode,
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
        message: refining
          ? `已重归初生，技能格 ${result.oldSkillCount} → ${result.newSkillCount}，寿命已恢复。`
          : result.oldSkill
            ? `${beastSkillPresentation(result.oldSkill).name} → ${beastSkillPresentation(result.newSkill!).name}`
            : `已学会${beastSkillPresentation(result.newSkill!).name}`,
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
        title={`${beast?.name ?? '灵兽'} · ${actionName}`}
        size="md"
        footer={
          selected ? (
            <div className="space-y-2 text-sm">
              <p>
                {refining ? `消耗${consumeQuantity}瓶` : '消耗一本'}
                {itemDefinition(selected.definitionId).name}
                {refining
                  ? '，重归0级，重新孕育资质、成长与天生技能。'
                  : '，随机覆盖一个已有技能，结果不可撤销。'}
              </p>
              {!valid ? (
                <p className="text-ink-secondary">{bookReason(selected)}</p>
              ) : null}
              <InkButton
                pending={pending}
                disabled={!valid}
                onClick={() => setConfirming(true)}
              >
                {actionName}
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
            刷新{itemName}
          </InkButton>
          {bagQuery.error ? <p role="alert">{bagQuery.error}</p> : null}
          {roster && inventory ? (
            <>
              <div className="text-ink-secondary flex justify-between text-xs">
                <span>储物袋 · 选择{itemName}</span>
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
                              选择此{itemName}
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
            <p>正在读取{itemName}……</p>
          )}
          {inventory &&
          !inventory.items.some(
            (item) => itemDefinition(item.definitionId).kind === itemKind,
          ) ? (
            <p className="text-ink-secondary">储物袋中暂无{itemName}</p>
          ) : null}
        </div>
      </InkDetailDrawer>
      <InkModal
        isOpen={confirming}
        title={`确认${actionName}`}
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
              确认{actionName}
            </InkButton>
          </div>
        }
      >
        <p className="text-sm leading-7">
          {refining ? (
            <>
              为{beast?.name}使用
              {selected
                ? itemDefinition(selected.definitionId).name
                : '归元灵露'}
              将消耗{consumeQuantity}瓶。
              等级、经验与加点归零，资质、成长及全部技能重新生成，技能格可能减少。
              原兽诀不返还，当前寿命恢复至原上限，结果不可撤销。
            </>
          ) : (
            <>
              为{beast?.name}学习将消耗一本
              {selected ? itemDefinition(selected.definitionId).name : '兽诀'}，
              随机替换该灵兽已有技能中的一个，结果不可撤销。确定学习吗？
            </>
          )}
        </p>
      </InkModal>
    </>
  );
}
