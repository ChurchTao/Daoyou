import { GameIcon } from '@app/components/ui/GameIcon';
import { InkButton } from '@app/components/ui/InkButton';
import { InkNotice } from '@app/components/ui/InkNotice';
import { InkSelect } from '@app/components/ui/InkSelect';
import type { AdminTowerView } from '@shared/contracts/adminTower';
import {
  TOWER_ELIGIBLE_REALMS,
  TOWER_MIN_REALM,
} from '@shared/lib/tower/helpers';
import { useEffect, useState } from 'react';

const kindLabels = { normal: '普通', elite: '精英', boss: '首领' };
const roleLabels = {
  leader: '主敌',
  striker: '输出',
  healer: '治疗',
  guard: '护卫',
};
const attributes = [
  ['maxHp', '气血'],
  ['maxMp', '法力'],
  ['physicalAtk', '物攻'],
  ['magicAtk', '法攻'],
  ['physicalDef', '物防'],
  ['magicDef', '法防'],
  ['speed', '速度'],
] as const;

export default function TowerEnemySetsRoute() {
  const [seasonKey, setSeasonKey] = useState('');
  const [realm, setRealm] = useState<string>(TOWER_MIN_REALM);
  const [floor, setFloor] = useState('1');
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<AdminTowerView | null>(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ realm, floor });
    if (seasonKey) query.set('seasonKey', seasonKey);
    void (async () => {
      try {
        const response = await fetch(`/api/admin/tower-enemy-sets?${query}`, {
          signal: controller.signal,
          cache: 'no-store',
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? '加载蜃楼配置失败');
        if (!controller.signal.aborted) setData(payload.data);
      } catch (cause) {
        if (!controller.signal.aborted) {
          setData(null);
          setError(cause instanceof Error ? cause.message : '加载蜃楼配置失败');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [seasonKey, realm, floor, refresh]);

  const beginLoad = () => {
    setLoading(true);
    setError('');
    setMessage('');
    setConfirming(false);
  };

  const regenerate = async () => {
    if (!data || loading || publishing) return;
    setPublishing(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/admin/tower-enemy-sets/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seasonKey: data.seasonKey,
          expectedFingerprint: data.fingerprint,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? '重新生成失败');
      setMessage('周配置已重新生成并发布。相同生成条件下，阵容可能保持一致。');
      setLoading(true);
      setRefresh((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '重新生成失败');
    } finally {
      setPublishing(false);
      setConfirming(false);
    }
  };

  const weeks = data
    ? [
        ...new Set([
          data.nextSeason.seasonKey,
          data.currentSeason.seasonKey,
          data.seasonKey,
          ...data.weeks.map((week) => week.seasonKey),
        ]),
      ]
        .sort()
        .reverse()
    : [];
  const configuration = !loading ? data?.configuration : null;
  const preview = configuration?.previews.find(
    (item) => item.floor === data?.floor,
  );
  const canPublish =
    data &&
    [data.currentSeason.seasonKey, data.nextSeason.seasonKey].includes(
      data.seasonKey,
    );
  const skillName = (id: string) =>
    configuration?.encounter.skills.find((skill) => skill.id === id)?.name ??
    (id === 'attack' ? '普攻' : id === 'defend' ? '防御' : id);

  return (
    <section className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl">蜃楼敌人</h1>
        <p className="text-ink-secondary mt-2 text-sm">
          查看已发布的每周二十层阵容，按挑战境界核查实际战斗属性。
        </p>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <InkSelect
          label="周次"
          value={seasonKey || data?.currentSeason.seasonKey || ''}
          onChange={(value) => {
            if (value !== (seasonKey || data?.currentSeason.seasonKey)) {
              beginLoad();
              setSeasonKey(value);
            }
          }}
          disabled={loading || publishing}
        >
          {!data && <option value="">本周</option>}
          {weeks.map((key) => (
            <option key={key} value={key}>
              {key.split('@')[0]}
              {key === data?.currentSeason.seasonKey
                ? ' · 本周'
                : key === data?.nextSeason.seasonKey
                  ? ' · 下周'
                  : ''}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="挑战境界"
          value={realm}
          onChange={(value) => {
            if (value !== realm) {
              beginLoad();
              setRealm(value);
            }
          }}
          disabled={loading || publishing}
        >
          {TOWER_ELIGIBLE_REALMS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </InkSelect>
        <InkSelect
          label="楼层"
          value={floor}
          onChange={(value) => {
            if (value !== floor) {
              beginLoad();
              setFloor(value);
            }
          }}
          disabled={loading || publishing}
        >
          {Array.from({ length: 20 }, (_, index) => (
            <option key={index + 1} value={index + 1}>
              第 {index + 1} 层 ·{' '}
              {
                kindLabels[
                  (index + 1) % 10 === 0
                    ? 'boss'
                    : (index + 1) % 5 === 0
                      ? 'elite'
                      : 'normal'
                ]
              }
            </option>
          ))}
        </InkSelect>
      </div>
      <div className="flex flex-wrap gap-3">
        <InkButton
          variant="secondary"
          disabled={loading || publishing}
          onClick={() => {
            beginLoad();
            setRefresh((value) => value + 1);
          }}
        >
          刷新
        </InkButton>
        {canPublish && (
          <InkButton
            disabled={loading || publishing}
            onClick={() => setConfirming(true)}
          >
            {publishing
              ? '发布中…'
              : data?.published
                ? '重新生成周配置'
                : '生成并发布周配置'}
          </InkButton>
        )}
      </div>
      {confirming && (
        <InkNotice tone="warning">
          <p>
            将发布 {data?.seasonKey.split('@')[0]}{' '}
            的全部二十层配置，所有境界共同使用。后续进入的楼层会使用新配置，已开战的战斗保持原快照，领奖记录不变。
          </p>
          <p className="mt-2">
            沿用现有确定性生成规则，相同周次、内容版本和历史配置可能生成相同阵容。
          </p>
          <div className="mt-3 flex gap-3">
            <InkButton disabled={publishing} onClick={() => void regenerate()}>
              确认生成并发布
            </InkButton>
            <InkButton
              variant="secondary"
              disabled={publishing}
              onClick={() => setConfirming(false)}
            >
              取消
            </InkButton>
          </div>
        </InkNotice>
      )}
      {error && <InkNotice tone="danger">{error}</InkNotice>}
      {message && <InkNotice tone="info">{message}</InkNotice>}
      {loading && <p role="status">正在读取周配置…</p>}
      {!loading && data && (
        <div className="text-ink-secondary space-y-1 text-sm break-all">
          <p>
            {data.published
              ? `内容版本：${data.published.contentVersion} · 生成器：${data.published.generatorVersion} · 结构版本：${data.published.schemaVersion}`
              : '该周尚未发布配置。'}{' '}
          </p>
          {configuration && (
            <p>
              周期：
              {new Date(
                configuration.season.seasonStartedAt,
              ).toLocaleString()}{' '}
              — {new Date(configuration.season.seasonEndsAt).toLocaleString()}
            </p>
          )}
          {data.published && !configuration && (
            <InkNotice tone="warning">
              该周属于旧内容版本，无法按当前规则展示。历史周仅保留记录，本周或下周可重新生成。
            </InkNotice>
          )}
        </div>
      )}
      {preview && configuration && (
        <>
          <header className="border-ink/15 border-t pt-4">
            <h2 className="text-xl">
              第 <span className="font-mono">{preview.floor}</span> 层 ·{' '}
              {kindLabels[preview.kind]} · {preview.name}
            </h2>
            <p className="text-ink-secondary mt-2 text-sm">
              {preview.labels.join(' · ')}
            </p>
          </header>
          <div className="space-y-4">
            {configuration.encounter.units.map((unit) => {
              const member = preview.members.find(
                (item) => item.id === unit.id,
              )!;
              const plan = configuration.encounter.plans[member.id];
              return (
                <article
                  key={unit.id}
                  className="border-ink/15 space-y-3 border border-dashed p-4"
                >
                  <h3 className="flex items-center gap-2 text-lg">
                    <GameIcon value={member.icon} />
                    {member.name}
                    <span className="text-ink-secondary text-sm">
                      {roleLabels[member.role]} · 等级{' '}
                      <span className="font-mono">{unit.level}</span>
                    </span>
                  </h3>
                  <dl className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                    {attributes.map(([key, label]) => (
                      <div key={key}>
                        <dt className="text-ink-secondary text-xs">{label}</dt>
                        <dd className="font-mono">{unit.attrs[key] ?? 0}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-sm">
                    行动循环：{plan.cycle.map(skillName).join(' → ')}；备用：
                    {skillName(plan.fallback)}
                  </p>
                  <p className="text-sm">
                    主动技能：{unit.skills?.map(skillName).join('、') || '无'}
                    ；被动技能：
                    {unit.passives?.map(skillName).join('、') || '无'}
                  </p>
                  <ul className="text-ink-secondary list-disc space-y-1 pl-5 text-sm">
                    {member.details.map((detail, index) => (
                      <li key={index}>{detail}</li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
