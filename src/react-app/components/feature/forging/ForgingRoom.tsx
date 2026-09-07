import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import { InkTooltip } from '@app/components/ui/InkTooltip';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type { ForgeRequest, ForgeView } from '@shared/contracts/forging';
import type { DaoEquipmentInstanceV1 } from '@shared/engine/combat-v6/equipment/types';
import { forgingCost } from '@shared/forging/rules';
import { itemDefinition } from '@shared/inventory';
import { MATERIAL_TYPE_NAMES } from '@shared/items/definitions/materials';
import { materialFactsOf } from '@shared/items/material';
import { QUALITY_ORDER } from '@shared/types/constants';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { combatV6Request, mutationBody } from '../combat-v6/request';
import { EquipmentDetails } from './EquipmentDetails';

const endpoint = '/api/combat-v6/forging';
export function ForgingRoom() {
  const [view, setView] = useState<ForgeView>();
  const [refresh, setRefresh] = useState(0);
  const [blueprintId, setBlueprintId] = useState('');
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [picker, setPicker] = useState<'blueprint' | 'materials' | 'confirm'>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    equipment: DaoEquipmentInstanceV1;
    previous?: unknown;
  }>();
  const busy = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void combatV6Request<ForgeView>(endpoint, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setView(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [refresh]);
  const blueprint = view?.inventory.items.find((i) => i.id === blueprintId);
  const definition = blueprint
    ? itemDefinition(blueprint.definitionId)
    : undefined;
  const cost = definition?.level ? forgingCost(definition.level) : undefined;
  const materials =
    view?.inventory.items
      .filter((i) => itemDefinition(i.definitionId).kind === 'material')
      .map((i) => ({
        ...i,
        facts: materialFactsOf(i.definitionId, i.instanceData),
      })) ?? [];
  const chosen = materials.filter((m) => quantities[m.id] > 0);
  const total = chosen.reduce((n, m) => n + quantities[m.id], 0);
  const boostCount = (types: string[]) =>
    chosen
      .filter((m) => types.includes(m.facts.type))
      .reduce((n, m) => n + quantities[m.id], 0);
  const valid =
    !!view &&
    !!cost &&
    !!definition?.level &&
    definition.level <= view.ownerLevel &&
    total === cost.quantity &&
    chosen.every(
      (m) =>
        Number.isInteger(quantities[m.id]) &&
        quantities[m.id] <= m.quantity &&
        QUALITY_ORDER[m.facts.rank] >= QUALITY_ORDER[cost.rank],
    ) &&
    view.spiritStones >= cost.spiritStones &&
    view.qi >= cost.qi;
  async function submit() {
    if (busy.current || !blueprint || !valid) return;
    busy.current = true;
    setPending(true);
    setError('');
    const input: ForgeRequest = {
      blueprint: { id: blueprint.id, revision: blueprint.revision },
      materials: chosen.map((m) => ({
        id: m.id,
        revision: m.revision,
        quantity: quantities[m.id],
      })),
    };
    const previous = view!.inventory.items.find(
      (i) =>
        i.equipped &&
        i.definitionId === 'equipment.v6' &&
        (i.instanceData as DaoEquipmentInstanceV1).slot === definition?.slot,
    )?.instanceData;
    try {
      const response = await consumeResourceMutation<{
        equipment: DaoEquipmentInstanceV1;
      }>(
        await fetch(endpoint, {
          ...mutationBody(input),
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      if (alive.current) setResult({ ...response, previous });
    } catch (e) {
      if (alive.current)
        setError(
          `${e instanceof Error ? e.message : '请求失败'}。请核对背包结果后重新备料。`,
        );
    } finally {
      busy.current = false;
      if (alive.current) {
        setPending(false);
        setPicker(undefined);
        setBlueprintId('');
        setQuantities({});
        setView(undefined);
        setRefresh((n) => n + 1);
      }
    }
  }
  return (
    <GameSceneFrame variant="workflow">
      <div className="space-y-6 text-sm">
        {error ? (
          <p role="alert" className="text-crimson">
            {error}{' '}
            <button
              className="underline"
              onClick={() => {
                setError('');
                setRefresh((n) => n + 1);
              }}
            >
              重新读取
            </button>
          </p>
        ) : null}
        {result ? (
          <section className="space-y-4">
            <p role="status">铸成「{result.equipment.name}」，已收入背包。</p>
            <EquipmentDetails
              data={result.equipment}
              previous={result.previous}
            />
            <div className="flex gap-4">
              <InkButton onClick={() => setResult(undefined)}>
                继续铸造
              </InkButton>
              <Link className="self-center underline" to="/game/inventory">
                查看背包与装配
              </Link>
            </div>
          </section>
        ) : (
          <>
            <section className="space-y-2">
              <p className="text-ink-secondary">图纸</p>
              <InkButton
                disabled={!view || pending}
                onClick={() => setPicker('blueprint')}
              >
                {blueprint?.name ?? '选择道装图纸'}
              </InkButton>
              {!view ? <p>正在查看物品……</p> : null}
            </section>
            {cost ? (
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <span>
                    材料 {total} / {cost.quantity} 件 · {cost.rank}起
                  </span>
                  <InkTooltip label="材料增益规则">
                    每件材料增加 1.8 个百分点，同组最多
                    9%。矿石增益白字择优，天材地宝增益器蕴条数择优，辅助或妖兽材料增益已有附灵数值择优。高品质无额外加成，器诀独立随机。
                  </InkTooltip>
                </div>
                {chosen.map((m) => (
                  <p key={m.id}>
                    {m.name} ×{quantities[m.id]} · {m.facts.rank}
                  </p>
                ))}
                <InkButton
                  disabled={pending}
                  onClick={() => setPicker('materials')}
                >
                  选择材料
                </InkButton>
                {total ? (
                  <p className="text-ink-secondary">
                    白字择优 +{(boostCount(['ore']) * 1.8).toFixed(1)}% ·
                    附灵择优 +
                    {(boostCount(['aux', 'monster']) * 1.8).toFixed(1)}% ·
                    器蕴择优 +{(boostCount(['tcdb']) * 1.8).toFixed(1)}%
                  </p>
                ) : null}
                <p>
                  {cost.spiritStones} 灵石 · {cost.qi} 天地灵气
                </p>
                {view &&
                (view.spiritStones < cost.spiritStones || view.qi < cost.qi) ? (
                  <p className="text-crimson">灵石或天地灵气不足</p>
                ) : null}
                <InkButton
                  disabled={!valid || pending}
                  onClick={() => setPicker('confirm')}
                >
                  铸造
                </InkButton>
              </section>
            ) : null}
          </>
        )}
        {picker ? (
          <InkDetailDrawer
            isOpen
            title={
              picker === 'blueprint'
                ? '选择图纸'
                : picker === 'materials'
                  ? '选择材料'
                  : '确认铸造'
            }
            onClose={() => {
              if (!pending) setPicker(undefined);
            }}
            size="sm"
          >
            <div className="space-y-4 text-sm">
              {picker === 'blueprint' ? (
                <>
                  {view?.inventory.items
                    .filter(
                      (i) =>
                        itemDefinition(i.definitionId).kind === 'blueprint',
                    )
                    .map((i) => (
                      <div key={i.id}>
                        <InkButton
                          disabled={
                            itemDefinition(i.definitionId).level! >
                            view.ownerLevel
                          }
                          onClick={() => {
                            setBlueprintId(i.id);
                            setQuantities({});
                            setPicker(undefined);
                          }}
                        >
                          {i.name} ×{i.quantity}
                        </InkButton>
                        {itemDefinition(i.definitionId).level! >
                        view.ownerLevel ? (
                          <span> 超过人物等级</span>
                        ) : null}
                      </div>
                    ))}
                  {!view?.inventory.items.some(
                    (i) => itemDefinition(i.definitionId).kind === 'blueprint',
                  ) ? (
                    <p>背包中没有道装图纸。</p>
                  ) : null}
                </>
              ) : picker === 'materials' ? (
                <>
                  <p>
                    请选择 {cost?.quantity} 件{cost?.rank}或更高品质的材料。
                  </p>
                  {materials.map((m) => (
                    <label
                      key={m.id}
                      className="border-ink/10 flex items-center justify-between gap-3 border-b py-2"
                    >
                      <span>
                        {m.name}
                        <span className="text-ink-secondary block">
                          {m.facts.rank} · {MATERIAL_TYPE_NAMES[m.facts.type]} ·
                          持有 {m.quantity}
                        </span>
                      </span>
                      <input
                        type="number"
                        aria-label={`${m.name}数量`}
                        className="border-ink/20 w-16 border bg-transparent p-2"
                        min={0}
                        max={Math.min(m.quantity, cost?.quantity ?? 0)}
                        value={quantities[m.id] ?? 0}
                        disabled={
                          !!cost &&
                          QUALITY_ORDER[m.facts.rank] < QUALITY_ORDER[cost.rank]
                        }
                        onChange={(e) =>
                          setQuantities((old) => ({
                            ...old,
                            [m.id]: Math.max(
                              0,
                              Math.min(
                                Number(e.target.value),
                                m.quantity,
                                cost?.quantity ?? 0,
                              ),
                            ),
                          }))
                        }
                      />
                    </label>
                  ))}
                  {!materials.length ? (
                    <p>背包中没有可用材料，请先从洞府宝库取出。</p>
                  ) : null}
                  <InkButton
                    disabled={total !== cost?.quantity}
                    onClick={() => setPicker(undefined)}
                  >
                    选好了
                  </InkButton>
                </>
              ) : (
                <>
                  <p>{blueprint?.name} ×1</p>
                  {chosen.map((m) => (
                    <p key={m.id}>
                      {m.name} ×{quantities[m.id]}
                    </p>
                  ))}
                  <p>
                    {cost?.spiritStones} 灵石 · {cost?.qi} 天地灵气
                  </p>
                  <p>必定生成一件道装，属性随机。成品自动入包。</p>
                  <InkButton
                    pending={pending}
                    disabled={!valid}
                    onClick={() => void submit()}
                  >
                    确认铸造
                  </InkButton>
                </>
              )}
            </div>
          </InkDetailDrawer>
        ) : null}
      </div>
    </GameSceneFrame>
  );
}
