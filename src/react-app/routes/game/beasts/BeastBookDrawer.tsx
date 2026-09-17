import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { InventoryHeader } from '@app/components/feature/items/InventoryHeader';
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
import {
  beastFoodCultivation,
  previewBeastFeeding,
} from '@shared/engine/combat-v6/beasts/feeding';
import { beastRefinementReason } from '@shared/engine/combat-v6/beasts/refinement';
import { BEAST_REFINEMENT } from '@shared/engine/combat-v6/beasts/refinement-config';
import { itemDefinition } from '@shared/inventory';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { useEffect, useRef, useState } from 'react';

export function BeastBookDrawer({
  beastId,
  mode = 'learn',
  close,
  onUpdate,
}: {
  beastId: string;
  mode?: 'learn' | 'refine' | 'feed';
  close: () => void;
  onUpdate: (view: BeastManagementView) => void;
}) {
  const feeding = mode === 'feed';
  const refining = mode === 'refine';
  const actionName = feeding ? '喂养' : refining ? '洗炼' : '领悟传承';
  const itemName = feeding ? '丹药或灵果' : refining ? '灵露' : '传承灵印';
  const itemKind = feeding
    ? 'consumable'
    : refining
      ? 'beast_refinement'
      : 'beast_book';
  const { pushToast } = useInkUI();
  const bagQuery = useInventoryBag();
  const inventory = bagQuery.data;
  const [roster, setData] = useState<BeastManagementView>();
  const unavailable = !inventory || bagQuery.isRefreshing || !!bagQuery.error;
  const [selectedId, setSelectedId] = useState<string>();
  const [quantity, setQuantity] = useState(1);
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
    if (feeding) {
      if (definition.kind !== 'consumable')
        return '此物品不能用于增加灵兽修为。';
      if (!beast || !roster) return '正在核对灵兽状态。';
      try {
        previewBeastFeeding(
          beast,
          ConsumableFactsSchema.parse(item.instanceData).spec,
          1,
          roster.ownerLevel,
        );
        return '';
      } catch (e) {
        return e instanceof Error ? e.message : '不可喂养';
      }
    }
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
    if (definition.kind !== 'beast_book') return '此物品不是传承灵印。';
    if (!definition.skillId) return '此灵印已无法用于领悟传承。';
    if (!beast || !roster) return '正在核对灵兽状态。';
    if (!beast.skillSlotCapacity) return '此灵兽没有可用技能格。';
    if (beast.level > roster.ownerLevel) return '灵兽等级超过人物等级上限。';
    if (beast.skills.includes(definition.skillId!)) return '灵兽已拥有此技能。';
    return '';
  }
  const selectedSkillId = selected
    ? itemDefinition(selected.definitionId).skillId
    : undefined;
  const selectedSkillName = selectedSkillId
    ? beastSkillPresentation(selectedSkillId).name
    : undefined;
  const consumeQuantity =
    BEAST_REFINEMENT.items.find((item) => item.id === selected?.definitionId)
      ?.consumeQuantity ?? 1;
  let feedingPreview: ReturnType<typeof previewBeastFeeding> | undefined;
  let feedingError = '';
  if (feeding && selected && beast && roster) {
    try {
      if (quantity > selected.quantity) throw new Error('物品数量不足');
      feedingPreview = previewBeastFeeding(
        beast,
        ConsumableFactsSchema.parse(selected.instanceData).spec,
        quantity,
        roster.ownerLevel,
      );
    } catch (e) {
      feedingError = e instanceof Error ? e.message : '不可喂养';
    }
  }
  const valid =
    !unavailable && !!selected && !bookReason(selected) && !feedingError;

  async function learn() {
    if (busy.current || unavailable || !valid || !confirming) return;
    busy.current = true;
    setPending(true);
    const signal = lifetime.current!.signal;
    try {
      const result = await consumeResourceMutation<{
        gained?: number;
        level?: number;
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
            ...(feeding ? { quantity } : {}),
          }),
          signal,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      if (signal.aborted) return;
      pushToast({
        message: feeding
          ? `灵兽修为 +${result.gained}，当前${result.level}级。`
          : refining
            ? `已重归初生，技能格 ${result.oldSkillCount} → ${result.newSkillCount}，寿命已恢复。`
            : result.oldSkill
              ? `${beastSkillPresentation(result.oldSkill).name} → ${beastSkillPresentation(result.newSkill!).name}`
              : `已领悟${beastSkillPresentation(result.newSkill!).name}`,
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
                {feeding
                  ? `消耗${quantity}颗`
                  : refining
                    ? `消耗${consumeQuantity}瓶`
                    : '消耗1枚'}
                {selected.name}
                {feeding
                  ? '。'
                  : refining
                    ? '，重归0级，重新孕育资质、成长与天生技能。'
                    : `，领悟「${selectedSkillName}」，随机覆盖一个已有技能，结果不可撤销。`}
              </p>
              {feeding ? (
                <label className="flex items-center gap-3">
                  数量
                  <input
                    aria-label="喂养数量"
                    type="number"
                    min={1}
                    max={Math.min(99, selected.quantity)}
                    value={quantity}
                    disabled={pending || confirming}
                    className="border-ink/20 w-24 border px-2 py-1 font-mono"
                    onChange={(event) =>
                      setQuantity(Number(event.target.value))
                    }
                  />
                </label>
              ) : null}
              {feedingPreview ? (
                <p className="font-mono">
                  修为 +{feedingPreview.gained.toLocaleString()} ·{' '}
                  {beast?.level}级 → {feedingPreview.beast.level}级
                </p>
              ) : null}
              {feedingPreview?.wasted ? (
                <p className="text-crimson">
                  达到当前等级上限，将损失
                  {feedingPreview.wasted.toLocaleString()}修为。
                </p>
              ) : null}
              {!valid ? (
                <p className="text-ink-secondary">
                  {feedingError || bookReason(selected)}
                </p>
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
          <InventoryHeader
            title={<>储物袋 · 选择{itemName}</>}
            capacity={
              <span className="font-mono">{inventory?.used ?? '—'} / 40</span>
            }
            actions={
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
            }
          />
          {bagQuery.error ? <p role="alert">{bagQuery.error}</p> : null}
          {roster && inventory ? (
            <>
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
                      ? () => {
                          setSelectedId(item.id);
                          setQuantity(1);
                        }
                      : undefined,
                    children: item
                      ? (hide) =>
                          book ? (
                            <InkButton
                              disabled={pending || unavailable}
                              onClick={() => {
                                setSelectedId(item.id);
                                setQuantity(1);
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
            (item) =>
              itemDefinition(item.definitionId).kind === itemKind &&
              (!feeding ||
                beastFoodCultivation(
                  ConsumableFactsSchema.parse(item.instanceData).spec,
                ) > 0),
          ) ? (
            <p className="text-ink-secondary">
              储物袋中暂无{feeding ? '增加灵兽修为的丹药或灵果' : itemName}
            </p>
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
            <InkButton
              variant="secondary"
              disabled={pending}
              onClick={() => setConfirming(false)}
            >
              取消
            </InkButton>
            <InkButton
              variant="primary"
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
          {feeding ? (
            <>
              为{beast?.name}喂养{quantity}颗{selected?.name}，增加
              {feedingPreview?.gained.toLocaleString()}修为，等级{beast?.level}{' '}
              → {feedingPreview?.beast.level}。
              {feedingPreview?.wasted
                ? `达到当前等级上限，溢出的${feedingPreview.wasted.toLocaleString()}修为将损失。`
                : ''}
            </>
          ) : refining ? (
            <>
              为{beast?.name}使用
              {selected
                ? itemDefinition(selected.definitionId).name
                : '归元灵露'}
              将消耗{consumeQuantity}瓶。
              等级重置为0级，五项基础属性均为10点，修为与加点归零，资质、成长及全部技能重新生成，技能格可能减少。
              原传承灵印不返还，当前寿命恢复至原上限，结果不可撤销。
            </>
          ) : (
            <>
              为{beast?.name}领悟「{selectedSkillName}」将消耗1枚
              {selected
                ? itemDefinition(selected.definitionId).name
                : '传承灵印'}
              ， 随机替换该灵兽已有技能中的一个，结果不可撤销。确定领悟吗？
            </>
          )}
        </p>
      </InkModal>
    </>
  );
}
