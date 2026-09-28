import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { CraftInventoryPanel } from '@app/components/feature/items/CraftInventoryPanel';
import {
  inventoryFilterActive,
  matchesInventoryFilters,
  type InventoryFilter,
} from '@app/components/feature/items/inventoryFilterModel';
import { InventoryItems } from '@app/components/feature/items/InventoryItems';
import { InkModal } from '@app/components/layout/InkModal';
import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { useInventoryBag } from '@app/lib/resources/bag';
import { useCraftStorage } from '@app/lib/resources/craftStorage';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { beastSkillPresentation } from '@shared/combat-v6/beast-skill-presentation';
import type { BeastManagementView } from '@shared/contracts/combatV6Beasts';
import type { InventoryView } from '@shared/contracts/inventory';
import { previewBeastFeeding } from '@shared/engine/combat-v6/beasts/feeding';
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
  const [source, setSource] = useState<'bag' | 'storage'>('bag');
  const [filter, setFilter] = useState<InventoryFilter>({ kind: itemKind });
  const storage = useCraftStorage(filter, source === 'storage');
  const inventory = source === 'bag' ? bagQuery.data : storage.view;
  const inventoryError = source === 'bag' ? bagQuery.error : storage.error;
  const inventoryLoading =
    source === 'bag' ? bagQuery.isRefreshing : storage.loading;
  const [roster, setData] = useState<BeastManagementView>();
  const unavailable = !inventory || inventoryLoading || !!inventoryError;
  const [selectedItem, setSelectedItem] =
    useState<InventoryView['items'][number]>();
  const [refinementBefore, setRefinementBefore] =
    useState<BeastManagementView['beasts'][number]>();
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
    if (beast.level > roster.ownerLevel) return '灵兽等级超过人物等级上限。';
    if (beast.skills.includes(definition.skillId!)) return '灵兽已拥有此技能。';
    return '';
  }
  const candidates =
    roster && inventory
      ? inventory.items.filter((item) =>
          source === 'storage' || !inventoryFilterActive(filter)
            ? true
            : matchesInventoryFilters(item, filter),
        )
      : [];
  const selected =
    candidates.find((item) => item.id === selectedItem?.id) ?? selectedItem;
  const selectedSkillId = selected
    ? itemDefinition(selected.definitionId).skillId
    : undefined;
  const learningEffect =
    beast?.skills.length === 0 ? '学会第一项技能' : '随机换掉一项已有技能';
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
  const requiresConfirmation = !feeding || !!feedingPreview?.wasted;

  async function learn() {
    if (
      busy.current ||
      unavailable ||
      !valid ||
      (requiresConfirmation && !confirming)
    )
      return;
    busy.current = true;
    setPending(true);
    const signal = lifetime.current!.signal;
    let committed = false;
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
      committed = true;
      if (signal.aborted) return;
      if (refining) setRefinementBefore(beast);
      const roster = await combatV6Request<BeastManagementView>(
        '/api/combat-v6/beasts',
        { signal },
      );
      if (!signal.aborted) {
        setData(roster);
        onUpdate(roster);
        bagQuery.invalidate();
        storage.reload();
        setSelectedItem(undefined);
        pushToast({
          message: feeding
            ? `灵兽修为 +${result.gained}，当前${result.level}级。`
            : refining
              ? `已重归初生，技能 ${result.oldSkillCount} → ${result.newSkillCount} 项，寿命已恢复。`
              : result.oldSkill
                ? `${beastSkillPresentation(result.oldSkill).name} → ${beastSkillPresentation(result.newSkill!).name}`
                : `已领悟${beastSkillPresentation(result.newSkill!).name}`,
          tone: 'success',
        });
      }
    } catch (e) {
      bagQuery.invalidate();
      storage.reload();
      if (!signal.aborted) {
        pushToast({
          message: committed
            ? '操作已完成，灵兽状态刷新失败，请刷新后查看。'
            : e instanceof Error
              ? e.message
              : '操作失败',
          tone: 'danger',
        });
        setData(undefined);
        setRefresh((value) => value + 1);
      }
    } finally {
      busy.current = false;
      if (!signal.aborted) {
        setPending(false);
        setConfirming(false);
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
                    ? '，重归0级，重新孕育资质、成长与技能。'
                    : `，领悟「${selectedSkillName}」，${learningEffect}，结果不可撤销。`}
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
                onClick={() => {
                  if (!requiresConfirmation) void learn();
                  else setConfirming(true);
                }}
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
          {refining &&
          refinementBefore &&
          beast &&
          beast.revision !== refinementBefore.revision ? (
            <section className="border-ink/15 border-b pb-4">
              <h3 className="text-teal mb-2">本次洗炼结果</h3>
              <p className="font-mono">
                成长 {refinementBefore.growth.toFixed(3)} →{' '}
                {beast.growth.toFixed(3)}
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 text-xs">
                {(
                  [
                    ['attack', '攻击资质'],
                    ['defense', '防御资质'],
                    ['health', '体力资质'],
                    ['mana', '法力资质'],
                    ['speed', '速度资质'],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex justify-between gap-2 py-1">
                    <dt>{label}</dt>
                    <dd className="font-mono">
                      {refinementBefore.aptitudes[key]} → {beast.aptitudes[key]}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2 text-xs">
                技能 {refinementBefore.skillSlotCapacity} → {beast.skillSlotCapacity}{' '}
                项
              </p>
            </section>
          ) : null}
          <CraftInventoryPanel
            source={source}
            onSource={(value) => {
              if (value === 'storage') storage.reload();
              setSource(value);
            }}
            view={inventory}
            loading={inventoryLoading}
            error={inventoryError}
            filter={filter}
            onFilter={(value) => {
              setFilter(value);
              storage.setPage(0);
            }}
            onPage={storage.setPage}
            onReload={() => {
              if (source === 'bag') void bagQuery.reload();
              else storage.reload();
              setRefresh((value) => value + 1);
            }}
          >
            {roster && inventory ? (
              <>
                <InventoryItems
                  items={candidates}
                  location={source}
                  compact={source === 'bag' && inventoryFilterActive(filter)}
                  quickTouchHint={candidates.length > 0}
                  slotProps={(item) => {
                    const reason = item ? bookReason(item) : '';
                    return {
                      selected: !!item && selected?.id === item.id,
                      disabled: pending || unavailable,
                      quickOnTouch: true,
                      onQuickAction:
                        item && !reason
                          ? () => {
                              setSelectedItem(item);
                              setQuantity(1);
                            }
                          : undefined,
                      children: item
                        ? (hide) =>
                            reason ? (
                              <p className="text-ink-secondary">{reason}</p>
                            ) : (
                              <InkButton
                                disabled={pending || unavailable}
                                onClick={() => {
                                  setSelectedItem(item);
                                  setQuantity(1);
                                  hide();
                                }}
                              >
                                选择此{itemName}
                              </InkButton>
                            )
                        : undefined,
                    };
                  }}
                />
                {!candidates.some((item) => !bookReason(item)) ? (
                  <p className="text-ink-secondary">
                    当前没有可用的{itemName}。
                  </p>
                ) : null}
              </>
            ) : (
              <p>正在读取{itemName}……</p>
            )}
          </CraftInventoryPanel>
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
              洗炼后成为0级幼崽。普通灵兽每项基础属性10点、变异灵兽每项20点，另有50点可分配。修为与已加的点清零，资质、成长和技能都会重来，原先融合或领悟的技能不会留下，技能也可能变少。
              用掉的传承灵印不退还，寿命恢复到上限，不能反悔。
              {beast?.isMutant ? '变异仍在。' : ''}
            </>
          ) : (
            <>
              为{beast?.name}领悟「{selectedSkillName}」将消耗1枚
              {selected
                ? itemDefinition(selected.definitionId).name
                : '传承灵印'}
              ，{learningEffect}，结果不可撤销。确定领悟吗？
            </>
          )}
        </p>
      </InkModal>
    </>
  );
}
