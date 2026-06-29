import { useInkUI } from '@app/components/providers/InkUIProvider';
import { InkButton } from '@app/components/ui/InkButton';
import { InkInput } from '@app/components/ui/InkInput';
import { InkSelect } from '@app/components/ui/InkSelect';
import type {
  AdminBattleDuelResult,
  AdminBattleMonteCarloResult,
  AdminBattleScenario,
} from '@shared/contracts/adminBattleSimulator';
import {
  ENEMY_RACE_VALUES,
  REALM_STAGE_VALUES,
  REALM_VALUES,
  type EnemyRace,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import { useState } from 'react';

type TabKey = 'duel' | 'monte-carlo';

type ApiResponse<T> = {
  success?: boolean;
  error?: string;
  data?: T;
};

const scenarioOptions: Array<{ value: AdminBattleScenario; label: string }> = [
  { value: 'fixed_vs_template', label: '固定角色 vs 模板' },
  { value: 'template_vs_template', label: '模板 vs 模板' },
  { value: 'fixed_vs_live_sample', label: '固定角色 vs 线上样本' },
  { value: 'live_sample_vs_live_sample', label: '线上样本 vs 线上样本' },
];

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success || !payload.data) {
    throw new Error(payload.error ?? '请求失败');
  }
  return payload.data;
}

function optionalValue<T extends string>(value: string): T[] | undefined {
  return value ? [value as T] : undefined;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function finalLine(result: AdminBattleDuelResult, side: 'a' | 'b') {
  const state = result.finalState[side].snapshot;
  return `${state.name} HP ${state.hp.current}/${state.hp.max} · MP ${state.mp.current}/${state.mp.max}`;
}

function LogsPanel({ logs }: { logs: string[] }) {
  return (
    <pre className="battle-scroll border-ink/15 bg-bgpaper/80 text-ink-secondary max-h-96 overflow-auto border border-dashed p-3 text-xs leading-6 whitespace-pre-wrap">
      {logs.length ? logs.join('\n') : '暂无日志'}
    </pre>
  );
}

function JsonPanel({ value }: { value: unknown }) {
  return (
    <pre className="battle-scroll border-ink/15 bg-bgpaper/80 text-ink-secondary max-h-96 overflow-auto border border-dashed p-3 text-xs leading-5 whitespace-pre-wrap">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function DuelResultView({ result }: { result: AdminBattleDuelResult }) {
  return (
    <section className="space-y-4">
      <div className="border-ink/15 bg-bgpaper/80 grid gap-3 border border-dashed p-4 md:grid-cols-3">
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">胜者</p>
          <p className="text-ink mt-1 font-semibold">
            {result.winnerSide} 方 ·{' '}
            {result.winnerSide === 'A'
              ? result.participants.a.name
              : result.participants.b.name}
          </p>
        </div>
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">回合</p>
          <p className="text-ink mt-1 font-semibold">{result.turns}</p>
        </div>
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">终态</p>
          <p className="text-ink-secondary mt-1 text-sm">{finalLine(result, 'a')}</p>
          <p className="text-ink-secondary text-sm">{finalLine(result, 'b')}</p>
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="font-heading text-ink text-xl">完整日志</h2>
        <LogsPanel logs={result.logs} />
      </div>

      <details className="space-y-2">
        <summary className="text-ink cursor-pointer font-semibold">
          结构化日志
        </summary>
        <JsonPanel value={result.logSpans} />
      </details>

      <details className="space-y-2">
        <summary className="text-ink cursor-pointer font-semibold">
          状态时间线
        </summary>
        <JsonPanel value={result.stateTimeline} />
      </details>
    </section>
  );
}

function MonteCarloResultView({
  result,
}: {
  result: AdminBattleMonteCarloResult;
}) {
  return (
    <section className="space-y-4">
      <div className="border-ink/15 bg-bgpaper/80 grid gap-3 border border-dashed p-4 md:grid-cols-5">
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">样本</p>
          <p className="text-ink mt-1 font-semibold">{result.sampleCount}</p>
        </div>
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">A 胜率</p>
          <p className="text-ink mt-1 font-semibold">
            {formatPercent(result.aWinRate)}
          </p>
        </div>
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">平均回合</p>
          <p className="text-ink mt-1 font-semibold">
            {result.turnStats.average}
          </p>
        </div>
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">P50</p>
          <p className="text-ink mt-1 font-semibold">{result.turnStats.p50}</p>
        </div>
        <div>
          <p className="text-ink-secondary text-xs tracking-[0.16em]">P95</p>
          <p className="text-ink mt-1 font-semibold">{result.turnStats.p95}</p>
        </div>
      </div>

      <div className="border-ink/15 overflow-x-auto border border-dashed">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-ink/5 text-ink-secondary">
            <tr>
              <th className="px-3 py-2">维度</th>
              <th className="px-3 py-2">值</th>
              <th className="px-3 py-2">样本</th>
              <th className="px-3 py-2">A 胜</th>
              <th className="px-3 py-2">B 胜</th>
              <th className="px-3 py-2">A 胜率</th>
              <th className="px-3 py-2">平均回合</th>
            </tr>
          </thead>
          <tbody>
            {result.breakdowns.map((item) => (
              <tr key={`${item.dimension}:${item.key}`} className="border-ink/10 border-t">
                <td className="px-3 py-2">{item.dimension}</td>
                <td className="px-3 py-2">{item.key}</td>
                <td className="px-3 py-2">{item.sampleCount}</td>
                <td className="px-3 py-2">{item.aWins}</td>
                <td className="px-3 py-2">{item.bWins}</td>
                <td className="px-3 py-2">{formatPercent(item.aWinRate)}</td>
                <td className="px-3 py-2">{item.averageTurns}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <h2 className="font-heading text-ink text-xl">样例日志</h2>
        {result.samples.map((sample) => (
          <details
            key={sample.index}
            className="border-ink/15 bg-bgpaper/70 border border-dashed p-3"
          >
            <summary className="text-ink cursor-pointer font-semibold">
              #{sample.index} · {sample.participants.a.name} vs{' '}
              {sample.participants.b.name} · {sample.winnerSide} 方胜 ·{' '}
              {sample.turns} 回合
            </summary>
            <div className="mt-3">
              <LogsPanel logs={sample.logs} />
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export default function AdminBattleSimulatorPage() {
  const { pushToast } = useInkUI();
  const [tab, setTab] = useState<TabKey>('duel');
  const [playerCultivatorId, setPlayerCultivatorId] = useState('');
  const [opponentCultivatorId, setOpponentCultivatorId] = useState('');
  const [duelResult, setDuelResult] = useState<AdminBattleDuelResult | null>(
    null,
  );
  const [scenario, setScenario] =
    useState<AdminBattleScenario>('fixed_vs_template');
  const [anchorCultivatorId, setAnchorCultivatorId] = useState('');
  const [sampleCount, setSampleCount] = useState('100');
  const [sampleLogLimit, setSampleLogLimit] = useState('3');
  const [templateRealm, setTemplateRealm] = useState('');
  const [templateStage, setTemplateStage] = useState('');
  const [templateRace, setTemplateRace] = useState('');
  const [difficultyMin, setDifficultyMin] = useState('0');
  const [difficultyMax, setDifficultyMax] = useState('100');
  const [liveRealm, setLiveRealm] = useState('');
  const [liveStage, setLiveStage] = useState('');
  const [monteCarloResult, setMonteCarloResult] =
    useState<AdminBattleMonteCarloResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const runDuel = async () => {
    try {
      setSubmitting(true);
      const data = await postJson<AdminBattleDuelResult>(
        '/api/admin/battle-simulator/duel',
        {
          playerCultivatorId: playerCultivatorId.trim(),
          opponentCultivatorId: opponentCultivatorId.trim(),
        },
      );
      setDuelResult(data);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : '精确对战失败',
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const runMonteCarlo = async () => {
    try {
      setSubmitting(true);
      const data = await postJson<AdminBattleMonteCarloResult>(
        '/api/admin/battle-simulator/monte-carlo',
        {
          scenario,
          anchorCultivatorId: anchorCultivatorId.trim() || undefined,
          sampleCount: Number(sampleCount || 100),
          sampleLogLimit: Number(sampleLogLimit || 3),
          templateFilters: {
            realms: optionalValue<RealmType>(templateRealm),
            realmStages: optionalValue<RealmStage>(templateStage),
            races: optionalValue<EnemyRace>(templateRace),
            difficultyMin: Number(difficultyMin || 0),
            difficultyMax: Number(difficultyMax || 100),
          },
          liveSampleFilters: {
            realms: optionalValue<RealmType>(liveRealm),
            realmStages: optionalValue<RealmStage>(liveStage),
          },
        },
      );
      setMonteCarloResult(data);
    } catch (error) {
      pushToast({
        message: error instanceof Error ? error.message : 'Monte Carlo 失败',
        tone: 'danger',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-ink/15 bg-bgpaper/80 border border-dashed p-5">
        <p className="text-ink-secondary text-xs tracking-[0.2em]">
          BATTLE BALANCE
        </p>
        <h1 className="font-heading text-ink mt-2 text-3xl">对战模拟器</h1>
      </header>

      <div className="border-ink/15 flex flex-wrap gap-2 border-b pb-2">
        <InkButton
          variant={tab === 'duel' ? 'primary' : 'secondary'}
          onClick={() => setTab('duel')}
        >
          精确对战
        </InkButton>
        <InkButton
          variant={tab === 'monte-carlo' ? 'primary' : 'secondary'}
          onClick={() => setTab('monte-carlo')}
        >
          Monte Carlo
        </InkButton>
      </div>

      {tab === 'duel' ? (
        <section className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <InkInput
              label="A 方角色 ID"
              value={playerCultivatorId}
              onChange={setPlayerCultivatorId}
              placeholder="active cultivator uuid"
            />
            <InkInput
              label="B 方角色 ID"
              value={opponentCultivatorId}
              onChange={setOpponentCultivatorId}
              placeholder="active cultivator uuid"
            />
          </div>
          <InkButton
            variant="primary"
            disabled={submitting}
            onClick={runDuel}
          >
            运行对战
          </InkButton>
          {duelResult && <DuelResultView result={duelResult} />}
        </section>
      ) : (
        <section className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <InkSelect
              label="场景"
              value={scenario}
              onChange={(value) => setScenario(value as AdminBattleScenario)}
            >
              {scenarioOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </InkSelect>
            <InkInput
              label="固定 A 方角色 ID"
              value={anchorCultivatorId}
              onChange={setAnchorCultivatorId}
              placeholder="固定角色场景必填"
            />
            <InkInput
              label="样本数"
              type="number"
              value={sampleCount}
              onChange={setSampleCount}
            />
            <InkInput
              label="样例日志数"
              type="number"
              value={sampleLogLimit}
              onChange={setSampleLogLimit}
            />
            <InkInput
              label="模板最低难度"
              type="number"
              value={difficultyMin}
              onChange={setDifficultyMin}
            />
            <InkInput
              label="模板最高难度"
              type="number"
              value={difficultyMax}
              onChange={setDifficultyMax}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <InkSelect
              label="模板境界"
              value={templateRealm}
              onChange={setTemplateRealm}
            >
              <option value="">全部</option>
              {REALM_VALUES.map((realm) => (
                <option key={realm} value={realm}>
                  {realm}
                </option>
              ))}
            </InkSelect>
            <InkSelect
              label="模板阶段"
              value={templateStage}
              onChange={setTemplateStage}
            >
              <option value="">全部</option>
              {REALM_STAGE_VALUES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </InkSelect>
            <InkSelect
              label="模板种族"
              value={templateRace}
              onChange={setTemplateRace}
            >
              <option value="">全部</option>
              {ENEMY_RACE_VALUES.map((race) => (
                <option key={race} value={race}>
                  {race}
                </option>
              ))}
            </InkSelect>
            <InkSelect
              label="线上样本境界"
              value={liveRealm}
              onChange={setLiveRealm}
            >
              <option value="">全部</option>
              {REALM_VALUES.map((realm) => (
                <option key={realm} value={realm}>
                  {realm}
                </option>
              ))}
            </InkSelect>
            <InkSelect
              label="线上样本阶段"
              value={liveStage}
              onChange={setLiveStage}
            >
              <option value="">全部</option>
              {REALM_STAGE_VALUES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </InkSelect>
          </div>

          <InkButton
            variant="primary"
            disabled={submitting}
            onClick={runMonteCarlo}
          >
            运行 Monte Carlo
          </InkButton>
          {monteCarloResult && <MonteCarloResultView result={monteCarloResult} />}
        </section>
      )}
    </div>
  );
}
