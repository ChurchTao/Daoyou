import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import {
  TOWER_ELIGIBLE_REALMS,
  type TowerPreparedEnemySetStatus,
} from '@shared/lib/tower';
import type { EnemyRace, RealmStage, RealmType } from '@shared/types/constants';
import { useCallback, useEffect, useMemo, useState } from 'react';

type TowerSeasonMeta = {
  seasonKey: string;
  seasonStartedAt: string;
  seasonEndsAt: string;
  nextResetAt: string;
};

type TowerEnemySummary = {
  floor: number;
  kind: 'normal' | 'elite' | 'boss';
  difficulty: number;
  race: EnemyRace;
  realmStage: RealmStage;
  name: string;
  title: string | null;
  source: 'llm' | 'fallback';
  generatedAt: string;
};

type TowerEnemySetRealmSummary = {
  seasonKey: string;
  realm: RealmType;
  status: TowerPreparedEnemySetStatus | 'missing' | 'incomplete';
  schemaVersion: number | null;
  enemyCount: number;
  generatedAt: string | null;
  updatedAt: string | null;
  errorMessage: string | null;
  sourceCounts: Record<'llm' | 'fallback', number>;
  enemies: TowerEnemySummary[];
};

type TowerEnemySetSnapshot = {
  seasonKey: string;
  realms: TowerEnemySetRealmSummary[];
};

type TowerEnemySetsResponse = {
  success?: boolean;
  error?: string;
  data?: {
    currentSeason: TowerSeasonMeta;
    nextSeason: TowerSeasonMeta;
    snapshot: TowerEnemySetSnapshot;
  };
};

type GenerateResponse = {
  success?: boolean;
  error?: string;
  data?: {
    result: unknown;
    snapshot: TowerEnemySetSnapshot;
  };
};

type TowerEnemySetsData = NonNullable<TowerEnemySetsResponse['data']>;
type GenerateData = NonNullable<GenerateResponse['data']>;

function formatDateTime(value: string | null): string {
  if (!value) return '暂无';
  return new Date(value).toLocaleString();
}

function getStatusLabel(status: TowerEnemySetRealmSummary['status']): string {
  switch (status) {
    case 'ready':
      return '已就绪';
    case 'failed':
      return '生成失败';
    case 'missing':
      return '未生成';
    case 'incomplete':
      return '数据不完整';
  }
}

function getKindLabel(kind: TowerEnemySummary['kind']): string {
  switch (kind) {
    case 'normal':
      return '普通';
    case 'elite':
      return '精英';
    case 'boss':
      return '首领';
  }
}

async function fetchTowerEnemySets(
  seasonKey: string,
): Promise<TowerEnemySetsData> {
  const query = new URLSearchParams();
  if (seasonKey.trim()) {
    query.set('seasonKey', seasonKey.trim());
  }
  const response = await fetch(`/api/admin/tower-enemy-sets?${query.toString()}`, {
    cache: 'no-store',
  });
  const payload = (await response.json()) as TowerEnemySetsResponse;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? '加载蜃楼敌人失败');
  }
  return payload.data;
}

async function generateTowerEnemySets(args: {
  seasonKey: string;
  realm: RealmType | 'all';
  force: boolean;
}): Promise<GenerateData> {
  const response = await fetch('/api/admin/tower-enemy-sets/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      seasonKey: args.seasonKey,
      realm: args.realm === 'all' ? undefined : args.realm,
      force: args.force,
    }),
  });
  const payload = (await response.json()) as GenerateResponse;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? '手动生成失败');
  }
  return payload.data;
}

export default function AdminTowerEnemySetsPage() {
  const { pushToast } = useInkUI();
  const [seasonKey, setSeasonKey] = useState('');
  const [snapshot, setSnapshot] = useState<TowerEnemySetSnapshot | null>(null);
  const [currentSeason, setCurrentSeason] = useState<TowerSeasonMeta | null>(null);
  const [nextSeason, setNextSeason] = useState<TowerSeasonMeta | null>(null);
  const [targetRealm, setTargetRealm] = useState<RealmType | 'all'>('all');
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const effectiveSeasonKey = seasonKey.trim() || currentSeason?.seasonKey || '';

  const load = useCallback(
    async (nextSeasonKey = seasonKey) => {
      try {
        setLoading(true);
        const data = await fetchTowerEnemySets(nextSeasonKey);
        setCurrentSeason(data.currentSeason);
        setNextSeason(data.nextSeason);
        setSnapshot(data.snapshot);
        setSeasonKey(data.snapshot.seasonKey);
      } catch (error) {
        pushToast({
          message: error instanceof Error ? error.message : '加载蜃楼敌人失败',
          tone: 'danger',
        });
      } finally {
        setLoading(false);
      }
    },
    [pushToast, seasonKey],
  );

  useEffect(() => {
    let cancelled = false;

    void fetchTowerEnemySets('')
      .then((data) => {
        if (cancelled) return;
        setCurrentSeason(data.currentSeason);
        setNextSeason(data.nextSeason);
        setSnapshot(data.snapshot);
        setSeasonKey(data.snapshot.seasonKey);
      })
      .catch((error) => {
        if (cancelled) return;
        pushToast({
          message: error instanceof Error ? error.message : '加载蜃楼敌人失败',
          tone: 'danger',
        });
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pushToast]);

  const totals = useMemo(() => {
    const realms = snapshot?.realms ?? [];
    return {
      ready: realms.filter((realm) => realm.status === 'ready').length,
      missing: realms.filter((realm) => realm.status === 'missing').length,
      failed: realms.filter((realm) => realm.status === 'failed').length,
      incomplete: realms.filter((realm) => realm.status === 'incomplete').length,
      enemies: realms.reduce((sum, realm) => sum + realm.enemyCount, 0),
      llm: realms.reduce((sum, realm) => sum + realm.sourceCounts.llm, 0),
      fallback: realms.reduce((sum, realm) => sum + realm.sourceCounts.fallback, 0),
    };
  }, [snapshot]);

  const submitGenerate = async () => {
    if (!effectiveSeasonKey) {
      pushToast({ message: '请先选择周版本', tone: 'danger' });
      return;
    }

    try {
      setGenerating(true);
      const data = await generateTowerEnemySets({
        seasonKey: effectiveSeasonKey,
        realm: targetRealm,
        force,
      });
      setSnapshot(data.snapshot);
      setSeasonKey(data.snapshot.seasonKey);
      pushToast({
        message:
          targetRealm === 'all'
            ? '已触发全部境界生成'
            : `已触发${targetRealm}敌人生成`,
        tone: 'success',
      });
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '手动生成失败',
        tone: 'danger',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-ink/15 bg-bgpaper/90 border border-dashed p-6">
        <p className="text-ink-secondary text-xs tracking-[0.22em]">
          TOWER OPS
        </p>
        <h2 className="font-heading text-ink mt-2 text-3xl">蜃楼敌人周表</h2>
        <p className="text-ink-secondary mt-3 max-w-3xl text-sm leading-7">
          查看每周蜃楼幻境预生成敌人的覆盖情况，并在缺失或失败时手动补齐。
          手动生成会触发敌人文案 LLM 调用。
        </p>
      </header>

      <section className="border-ink/15 bg-bgpaper/90 space-y-4 border border-dashed p-6">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <InkInput
            label="周版本"
            value={seasonKey}
            onChange={setSeasonKey}
            placeholder="2026-W23@Asia/Shanghai"
            hint="留空加载当前周；也可填指定 seasonKey 查询历史周。"
            disabled={loading || generating}
          />
          <div className="flex flex-wrap gap-2">
            <InkButton
              variant="secondary"
              disabled={loading || generating}
              onClick={() => void load(seasonKey)}
            >
              查询
            </InkButton>
            <InkButton
              variant="secondary"
              disabled={loading || generating || !currentSeason}
              onClick={() => {
                const key = currentSeason?.seasonKey ?? '';
                setSeasonKey(key);
                void load(key);
              }}
            >
              当前周
            </InkButton>
            <InkButton
              variant="secondary"
              disabled={loading || generating || !nextSeason}
              onClick={() => {
                const key = nextSeason?.seasonKey ?? '';
                setSeasonKey(key);
                void load(key);
              }}
            >
              下周
            </InkButton>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <SummaryTile label="已就绪" value={String(totals.ready)} />
          <SummaryTile label="未生成" value={String(totals.missing)} />
          <SummaryTile label="失败" value={String(totals.failed)} />
          <SummaryTile label="不完整" value={String(totals.incomplete)} />
          <SummaryTile label="敌人数" value={String(totals.enemies)} />
          <SummaryTile
            label="来源"
            value={`${totals.llm} LLM / ${totals.fallback} fallback`}
          />
        </div>

        <div className="border-ink/15 bg-paper/80 grid gap-3 border border-dashed p-4 md:grid-cols-[minmax(0,220px)_auto_auto] md:items-end">
          <InkSelect
            label="生成范围"
            value={targetRealm}
            onChange={(value) => setTargetRealm(value as RealmType | 'all')}
            disabled={loading || generating}
          >
            <option value="all">全部开放境界</option>
            {TOWER_ELIGIBLE_REALMS.map((realm) => (
              <option key={realm} value={realm}>
                {realm}
              </option>
            ))}
          </InkSelect>
          <label className="text-ink-secondary flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={force}
              disabled={loading || generating}
              onChange={(event) => setForce(event.target.checked)}
            />
            强制覆盖已有 ready 数据
          </label>
          <InkButton
            variant="primary"
            disabled={loading || generating || !effectiveSeasonKey}
            onClick={() => void submitGenerate()}
          >
            {generating ? '生成中...' : '手动生成'}
          </InkButton>
        </div>
      </section>

      <section className="space-y-4">
        {loading ? (
          <p className="text-ink-secondary text-sm">正在加载蜃楼敌人周表...</p>
        ) : null}
        {(snapshot?.realms ?? []).map((realm) => (
          <RealmPanel key={realm.realm} realm={realm} />
        ))}
      </section>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-ink/15 bg-paper/80 border border-dashed p-3">
      <p className="text-ink-secondary text-xs tracking-[0.16em]">{label}</p>
      <p className="text-ink mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function RealmPanel({ realm }: { realm: TowerEnemySetRealmSummary }) {
  return (
    <div className="border-ink/15 bg-bgpaper/90 border border-dashed p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-ink text-xl font-semibold">{realm.realm}</h3>
          <p className="text-ink-secondary mt-1 text-sm">
            {getStatusLabel(realm.status)} · {realm.enemyCount}/20 层 ·
            schema {realm.schemaVersion ?? '-'}
          </p>
        </div>
        <div className="text-ink-secondary text-right text-xs leading-6">
          <div>生成：{formatDateTime(realm.generatedAt)}</div>
          <div>更新：{formatDateTime(realm.updatedAt)}</div>
        </div>
      </div>

      {realm.errorMessage ? (
        <p className="text-crimson mt-3 text-sm">{realm.errorMessage}</p>
      ) : null}

      {realm.enemies.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-ink-secondary border-ink/15 border-b">
              <tr>
                <th className="px-2 py-2 font-semibold">层</th>
                <th className="px-2 py-2 font-semibold">类型</th>
                <th className="px-2 py-2 font-semibold">敌人</th>
                <th className="px-2 py-2 font-semibold">种族/阶段</th>
                <th className="px-2 py-2 font-semibold">难度</th>
                <th className="px-2 py-2 font-semibold">来源</th>
              </tr>
            </thead>
            <tbody>
              {realm.enemies.map((enemy) => (
                <tr
                  key={`${realm.realm}:${enemy.floor}`}
                  className="border-ink/10 border-b last:border-b-0"
                >
                  <td className="px-2 py-2">{enemy.floor}</td>
                  <td className="px-2 py-2">{getKindLabel(enemy.kind)}</td>
                  <td className="px-2 py-2">
                    {enemy.name}
                    {enemy.title ? (
                      <span className="text-ink-secondary">「{enemy.title}」</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    {enemy.race} / {enemy.realmStage}
                  </td>
                  <td className="px-2 py-2">{enemy.difficulty}</td>
                  <td className="px-2 py-2">{enemy.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-ink-secondary mt-4 text-sm">暂无敌人数据。</p>
      )}
    </div>
  );
}
