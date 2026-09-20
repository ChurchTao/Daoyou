import { BeastTradeDetails } from '@app/components/feature/beasts/BeastTradePreview';
import {
  combatV6Request,
  CombatV6RequestError,
  mutationBody,
} from '@app/components/feature/combat-v6/request';
import { InkButton } from '@app/components/ui/InkButton';
import { InkDetailDrawer } from '@app/components/ui/InkDetailDrawer';
import {
  BeastFusionRequestSchema,
  type BeastFusionRequest,
  type BeastFusionResponse,
  type BeastManagementView,
} from '@shared/contracts/combatV6Beasts';
import {
  BEAST_SKILLS,
  BEAST_SPECIES,
  type SummonedBeast,
} from '@shared/engine/combat-v6/beasts';
import {
  beastFusionMaterialReason,
  beastFusionReason,
  fusionPreview,
} from '@shared/engine/combat-v6/beasts/fusion';
import { BEAST_FUSION } from '@shared/engine/combat-v6/beasts/fusion-config';
import { beastOriginName } from '@shared/engine/combat-v6/beasts/identity';
import { useRef, useState } from 'react';

export function BeastFusionDrawer({
  view,
  ownerId,
  close,
  onUpdate,
}: {
  view: BeastManagementView;
  ownerId: string;
  close: () => void;
  onUpdate: (view: BeastManagementView, resultId: string) => void;
}) {
  const storageKey = `beast-fusion:${ownerId}`;
  const [request, setRequest] = useState<BeastFusionRequest | undefined>(() => {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return;
    try {
      return BeastFusionRequestSchema.parse(JSON.parse(raw));
    } catch {
      sessionStorage.removeItem(storageKey);
      return;
    }
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<SummonedBeast>();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const materials = selected
    .map((id) => view.beasts.find((b) => b.id === id))
    .filter((b): b is SummonedBeast => !!b);
  const reason =
    materials.length === 2
      ? beastFusionReason(
          materials[0],
          materials[1],
          view.ownerLevel,
          view.lineup,
        )
      : '请选择两只灵兽';
  async function submit() {
    if (busy.current) return;
    if (!request && reason) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const input =
        request ??
        BeastFusionRequestSchema.parse({
          requestId: crypto.randomUUID(),
          parents: materials.map((b) => ({
            beastId: b.id,
            expectedRevision: b.revision,
          })),
        });
      // Persist before sending: a reload or lost response must never create a new roll.
      sessionStorage.setItem(storageKey, JSON.stringify(input));
      setRequest(input);
      const previous = await combatV6Request<BeastFusionResponse | null>(
        `/api/combat-v6/beasts/fusions/${input.requestId}`,
      );
      const response =
        previous ??
        (await combatV6Request<BeastFusionResponse>(
          '/api/combat-v6/beasts/fuse',
          mutationBody(input),
        ));
      onUpdate(response.view, response.result.id);
      setResult(response.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : '结果读取失败，请重试');
      if (
        e instanceof CombatV6RequestError &&
        e.code === 'BEAST_FUSION_REJECTED'
      ) {
        sessionStorage.removeItem(storageKey);
        setRequest(undefined);
        setConfirming(false);
        setSelected([]);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function finish() {
    if (busy.current) return;
    if (result) sessionStorage.removeItem(storageKey);
    close();
  }
  return (
    <InkDetailDrawer
      isOpen
      title={result ? '融合结果' : '灵兽融合'}
      onClose={finish}
      size="lg"
      footer={
        result ? (
          <InkButton variant="primary" onClick={finish}>
            查看新灵兽
          </InkButton>
        ) : request ? (
          <InkButton pending={pending} onClick={() => void submit()}>
            恢复本次融合结果
          </InkButton>
        ) : confirming ? (
          <>
            <InkButton disabled={pending} onClick={() => setConfirming(false)}>
              重新选择
            </InkButton>
            <InkButton
              variant="primary"
              pending={pending}
              disabled={!!reason}
              onClick={() => void submit()}
            >
              消耗两只灵兽并融合
            </InkButton>
          </>
        ) : (
          <InkButton
            variant="primary"
            disabled={!!reason}
            onClick={() => setConfirming(true)}
          >
            查看融合预览
          </InkButton>
        )
      }
    >
      {error && (
        <p role="alert" className="text-crimson mb-4 text-sm">
          {error}
        </p>
      )}
      {result ? (
        <BeastTradeDetails beast={result} />
      ) : request ? (
        <p className="text-sm leading-7">
          本次融合尚未确认结果。恢复时会查询原记录；如果尚未完成，将继续同一次融合。
        </p>
      ) : confirming && materials.length === 2 ? (
        <div className="space-y-5 text-sm">
          <p className="text-crimson">
            {materials[0].name}与{materials[1].name}
            将永久消耗，获得一只新灵兽。融合不额外收取灵石。
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            {materials.map((b) => (
              <BeastTradeDetails key={b.id} beast={b} />
            ))}
          </div>
          <p>
            {materials.every((b) => b.originKind === 'baby')
              ? `宝宝 ${BEAST_FUSION.babyChance * 100}% · 假宝宝 ${Math.round((1 - BEAST_FUSION.babyChance) * 100)}%`
              : `假宝宝 ${BEAST_FUSION.pseudoBabyChance * 100}% · 纯野生 ${(1 - BEAST_FUSION.pseudoBabyChance) * 100}%`}
            。宝宝与假宝宝为0级；纯野生为双方平均等级向下取整。
          </p>
          <ul className="space-y-2">
            {fusionPreview(materials[0], materials[1]).map((p) => (
              <li key={p.speciesId}>
                {BEAST_SPECIES.find((s) => s.id === p.speciesId)?.name} ·{' '}
                {materials[0].speciesId === materials[1].speciesId
                  ? '100%'
                  : '50%'}{' '}
                · 最多 <span className="font-mono">{p.maxSkills}</span> 技能
                <span className="text-ink-secondary block">
                  必带：
                  {p.core
                    .map(
                      (id) =>
                        BEAST_SKILLS.find((skill) => skill.id === id)?.name,
                    )
                    .join('、') || '无'}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-ink-secondary">
            结果物种必带技能恢复；双方其他不同技能各有50%概率继承，共有技能只抽一次。资质与成长围绕双方均值波动，可能降低；不继承加点。
          </p>
          {reason && <p className="text-crimson">{reason}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-ink-secondary text-sm">
            选择两只达到{BEAST_FUSION.minimumLevel}级、未携带的普通灵兽。
          </p>
          {view.beasts.map((b) => {
            const blocked = beastFusionMaterialReason(
              b,
              view.ownerLevel,
              view.lineup,
            );
            const checked = selected.includes(b.id);
            return (
              <label
                key={b.id}
                className="border-ink/10 flex items-start gap-3 border-b py-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={!!blocked || (!checked && selected.length === 2)}
                  onChange={() =>
                    setSelected(
                      checked
                        ? selected.filter((id) => id !== b.id)
                        : [...selected, b.id],
                    )
                  }
                />
                <span>
                  {b.name} · {beastOriginName(b)} ·{' '}
                  <span className="font-mono">{b.level}</span>级 ·{' '}
                  <span className="font-mono">{b.skills.length}</span>技能
                  {blocked && (
                    <span className="text-ink-secondary mt-1 block text-xs">
                      {blocked}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
      )}
    </InkDetailDrawer>
  );
}
