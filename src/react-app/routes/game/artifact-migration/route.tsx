import {
  combatV6Request,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { ItemSlot } from '@app/components/feature/items/ItemSlot';
import { GameSceneFrame } from '@app/components/game-shell/GameSceneFrame';
import { InkModal } from '@app/components/layout/InkModal';
import { InkButton } from '@app/components/ui/InkButton';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import type {
  ArtifactMigrationResult,
  ArtifactMigrationSource,
  ArtifactMigrationView,
} from '@shared/contracts/artifactMigration';
import {
  DAO_EQUIPMENT_SLOTS,
  type DaoEquipmentSlot,
} from '@shared/engine/combat-v6/equipment/types';
import {
  DAO_WEAPONS,
  DAO_WEAPON_TYPES,
  type DaoWeaponType,
} from '@shared/engine/combat-v6/equipment/weapons';
import type { ItemGrant } from '@shared/inventory';
import {
  BLUEPRINTS,
  EQUIPMENT_SLOT_NAMES,
} from '@shared/items/definitions/equipment-blueprints';
import { useCallback, useEffect, useRef, useState } from 'react';

const endpoint = '/api/artifact-migration';
function MigrationPage({ ownerId }: { ownerId: string }) {
  const [view, setView] = useState<ArtifactMigrationView>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const [confirm, setConfirm] = useState<ArtifactMigrationSource | null>(null);
  const [slot, setSlot] = useState<DaoEquipmentSlot>('weapon');
  const [weaponType, setWeaponType] = useState<DaoWeaponType>('sword');
  const [result, setResult] = useState<ArtifactMigrationResult>();
  const [page, setPage] = useState(0);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const next = await combatV6Request<ArtifactMigrationView>(endpoint, {
        signal,
      });
      if (alive.current && !signal?.aborted && next.ownerId === ownerId)
        setView(next);
    },
    [ownerId],
  );
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void refresh(controller.signal).catch((e) => {
      if (!controller.signal.aborted) setError(e.message);
    });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [refresh]);
  async function reload() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await refresh();
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function submit() {
    if (!confirm || view?.blockedReason || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      const data = await consumeResourceMutation<ArtifactMigrationResult>(
        await fetch(
          `${endpoint}/exchange`,
          mutationBody({
            productId: confirm.id,
            slot,
            ...(slot === 'weapon' ? { weaponType } : {}),
          }),
        ),
      );
      if (!alive.current) return;
      setResult(data);
      setConfirm(null);
      await refresh();
    } catch (e) {
      if (alive.current) {
        setError(
          e instanceof Error &&
            !(e instanceof SyntaxError) &&
            !(e instanceof TypeError)
            ? e.message
            : '结果暂未确认，请刷新旧法宝列表并核对背包或仓库后重试',
        );
        setConfirm(null);
        await refresh().catch(() => undefined);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const pending = view?.pending ?? [];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(pending.length / 20) - 1),
  );
  return (
    <GameSceneFrame variant="workflow">
      {error && (
        <p role="alert" className="text-crimson break-words">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span>
          待兑换 <span className="font-mono">{pending.length}</span> 件
        </span>
        <InkButton
          variant="secondary"
          disabled={busy}
          onClick={() => void reload()}
        >
          刷新核对
        </InkButton>
      </div>
      {!view ? (
        <p role="status">正在清点旧日法宝……</p>
      ) : (
        <>
          {view.blockedReason && (
            <p role="status" className="text-ink-secondary">
              {view.blockedReason}
            </p>
          )}
          <div className="divide-ink/15 divide-y">
            {!pending.length && (
              <p className="text-ink-secondary py-6 text-sm">
                没有待兑换的旧法宝。已领取的道装和图纸可在背包或仓库查看。
              </p>
            )}
            {pending
              .slice(currentPage * 20, currentPage * 20 + 20)
              .map((source) => (
                <div
                  key={source.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-semibold break-words">{source.name}</p>
                    <p className="text-ink-secondary text-sm">
                      {source.quality ?? '品质未记载'} · 评分{' '}
                      <span className="font-mono">{source.score}</span>
                    </p>
                    {source.problem ? (
                      <p className="text-crimson text-sm">{source.problem}</p>
                    ) : (
                      <p className="text-sm">
                        {source.realm}道装 <span className="font-mono">×1</span>{' '}
                        · 图纸{' '}
                        <span className="font-mono">×{source.blueprints}</span>
                      </p>
                    )}
                  </div>
                  <InkButton
                    disabled={busy || !!view.blockedReason || !!source.problem}
                    onClick={() => {
                      setSlot('weapon');
                      setWeaponType('sword');
                      setConfirm(source);
                    }}
                  >
                    选择部位
                  </InkButton>
                </div>
              ))}
          </div>
          {pending.length > 20 && (
            <div className="flex items-center gap-3 py-3">
              <InkButton
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                上一页
              </InkButton>
              <span className="font-mono">
                {currentPage + 1} / {Math.ceil(pending.length / 20)}
              </span>
              <InkButton
                disabled={(currentPage + 1) * 20 >= pending.length}
                onClick={() => setPage(currentPage + 1)}
              >
                下一页
              </InkButton>
            </div>
          )}
          <InkModal
            isOpen={!!confirm}
            onClose={() => {
              if (!busy) setConfirm(null);
            }}
            title="兑换旧法宝"
            footer={
              <div className="flex justify-end gap-2">
                <InkButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setConfirm(null)}
                >
                  取消
                </InkButton>
                <InkButton
                  disabled={busy || !!view.blockedReason}
                  onClick={() => void submit()}
                >
                  {busy ? '正在结算…' : '兑换并全部领取'}
                </InkButton>
              </div>
            }
          >
            {confirm && (
              <div className="space-y-4 text-sm">
                <p className="break-words">
                  收回「{confirm.name}」，获得{' '}
                  <span className="font-mono">1</span> 件{confirm.realm}道装及{' '}
                  <span className="font-mono">{confirm.blueprints}</span> 张
                  {confirm.realm}图纸。
                </p>
                {confirm.spiritStones > 0 && (
                  <p>
                    神品额外赠送灵石{' '}
                    <span className="font-mono">
                      {confirm.spiritStones.toLocaleString()}
                    </span>{' '}
                    和小聚灵符 <span className="font-mono">×1</span>。
                  </p>
                )}
                <p className="text-ink-secondary">
                  {confirm.fallback
                    ? '旧境界缺失或无效，按金丹兑换。'
                    : `旧锚定境界：${confirm.anchorRealm}；兑换境界：${confirm.realm}。`}
                </p>
                <fieldset disabled={busy} className="space-y-2">
                  <legend className="mb-2">道装部位</legend>
                  <div className="flex flex-wrap gap-2">
                    {DAO_EQUIPMENT_SLOTS.map((s) => (
                      <InkButton
                        key={s}
                        variant={slot === s ? 'primary' : 'secondary'}
                        aria-pressed={slot === s}
                        onClick={() => setSlot(s)}
                      >
                        {EQUIPMENT_SLOT_NAMES[s]}
                      </InkButton>
                    ))}
                  </div>
                </fieldset>
                {slot === 'weapon' && (
                  <fieldset disabled={busy} className="space-y-2">
                    <legend className="mb-2">法兵器形</legend>
                    <div className="flex flex-wrap gap-2">
                      {DAO_WEAPON_TYPES.map((w) => (
                        <InkButton
                          key={w}
                          variant={weaponType === w ? 'primary' : 'secondary'}
                          aria-pressed={weaponType === w}
                          onClick={() => setWeaponType(w)}
                        >
                          {DAO_WEAPONS[w].name}
                        </InkButton>
                      ))}
                    </div>
                  </fieldset>
                )}
                <p>
                  已选：{confirm.realm} · {EQUIPMENT_SLOT_NAMES[slot]}
                  {slot === 'weapon'
                    ? ` · ${DAO_WEAPONS[weaponType].name}`
                    : ''}
                </p>
                <p className="text-ink-secondary">
                  道装数值、器蕴和器诀按普通打造随机生成。图纸每张独立等概率抽取六个部位，可能重复。
                </p>
                <p className="text-ink-secondary">
                  本次兑换不消耗材料、灵石或灵气；全部奖励同时发放，背包不足进入仓库。穿戴仍需满足道装要求，图纸后续打造按正常规则消耗资源。
                </p>
              </div>
            )}
          </InkModal>
          <InkModal
            isOpen={!!result}
            onClose={() => setResult(undefined)}
            title="焕新所得"
            footer={
              <InkButton onClick={() => setResult(undefined)}>收下</InkButton>
            }
          >
            {result && (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <div className="w-24">
                    <ItemSlot
                      className="w-full"
                      quantityLabel="奖励"
                      item={{
                        definitionId: 'equipment.v6',
                        name: result.equipment.name,
                        quantity: 1,
                        instanceData: result.equipment,
                      }}
                    />
                  </div>
                  {(
                    [...result.blueprints, ...result.bonusGrants] as ItemGrant[]
                  ).map((g) => (
                    <div key={g.definitionId} className="w-24">
                      <ItemSlot
                        className="w-full"
                        quantityLabel="奖励"
                        item={{
                          ...g,
                          name:
                            g.instanceData?.name ??
                            BLUEPRINTS.find((b) => b.id === g.definitionId)
                              ?.name ??
                            g.definitionId,
                          instanceData: g.instanceData ?? null,
                        }}
                      />
                    </div>
                  ))}
                </div>
                {result.spiritStones > 0 && (
                  <p className="text-sm">
                    额外获得灵石{' '}
                    <span className="font-mono">
                      {result.spiritStones.toLocaleString()}
                    </span>
                    。
                  </p>
                )}
                <p className="text-sm">
                  奖励已发放，背包不足的部分已存入仓库。
                </p>
              </div>
            )}
          </InkModal>
        </>
      )}
    </GameSceneFrame>
  );
}
export default function Page() {
  const identity = usePlayerSession();
  const ownerId = identity.data?.activeCultivator?.id;
  return ownerId ? (
    <MigrationPage key={ownerId} ownerId={ownerId} />
  ) : (
    <p role="status">{identity.error ?? '正在核对身份……'}</p>
  );
}
