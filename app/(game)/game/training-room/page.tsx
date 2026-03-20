'use client';

import { InkButton } from '@/components/ui/InkButton';
import { InkCard } from '@/components/ui/InkCard';
import { InkDivider } from '@/components/ui/InkDivider';
import { BattleEngineV2 } from '@/engine/battle/BattleEngine.v2';
import type { TurnSnapshot } from '@/engine/battle/types';
import { useCultivator } from '@/lib/contexts/CultivatorContext';
import type { Cultivator } from '@/types/cultivator';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

/**
 * 练功房页面 - 修复版
 */
const DUMMY_HP = 1000000000;

export default function TrainingRoomPage() {
  const router = useRouter();
  const { cultivator, isLoading } = useCultivator();
  const [isFighting, setIsFighting] = useState(false);
  const [logs, setLogs] = useState<string[]>([
    '[系统] 你走进了练功房，四周空旷静谧。',
  ]);
  const [currentSnapshot, setCurrentSnapshot] = useState<TurnSnapshot | null>(
    null,
  );
  const logEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动日志
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStartTraining = async () => {
    if (!cultivator || isFighting) return;

    setIsFighting(true);
    setLogs(['[系统] 演武开始。你屏息凝神，望向前方。']);

    // 1. 定义 100 亿血量木桩 (Dummy)
    const mockDummy: Cultivator = {
      id: 'dummy',
      name: '木桩',
      age: 0,
      lifespan: 9999,
      attributes: {
        vitality: 10,
        spirit: 10,
        wisdom: 10,
        speed: 10,
        willpower: 10,
      },
      spiritual_roots: [],
      pre_heaven_fates: [],
      cultivations: [],
      skills: [],
      inventory: { artifacts: [], consumables: [], materials: [] },
      equipped: { weapon: null, armor: null, accessory: null },
      max_skills: 0,
      spirit_stones: 0,
      gender: '男',
      realm: '炼气',
      realm_stage: '初期',
    };

    // 2. 执行战斗模拟
    const engine = new BattleEngineV2();
    const result = engine.simulateBattle(cultivator, mockDummy, {
      isTraining: true,
      opponentMaxHpOverride: DUMMY_HP,
    });

    // 3. 初始快照同步
    if (result.timeline.length > 0) {
      setCurrentSnapshot(result.timeline[0]);
    }

    // 4. 逐行展示日志与状态同步
    let currentLogIndex = 0;
    let currentTurn = 0;

    const interval = setInterval(() => {
      if (currentLogIndex < result.log.length) {
        const nextLog = result.log[currentLogIndex];
        setLogs((prev) => [...prev, nextLog]);

        // 检查是否进入新回合，同步快照
        if (nextLog.startsWith('[第') && nextLog.includes('回合]')) {
          const turnMatch = nextLog.match(/第(\d+)回合/);
          if (turnMatch) {
            currentTurn = parseInt(turnMatch[1], 10);
            const snap = result.timeline.find((s) => s.turn === currentTurn);
            if (snap) {
              setCurrentSnapshot(snap);
            }
          }
        }

        currentLogIndex++;
      } else {
        clearInterval(interval);
        setIsFighting(false);
        // 战斗结束，显示最后的快照并输出总伤害
        if (result.timeline.length > 0) {
          const lastSnap = result.timeline[result.timeline.length - 1];
          setCurrentSnapshot(lastSnap);

          const totalDamage = DUMMY_HP - lastSnap.opponent.hp;
          setLogs((prev) => [
            ...prev,
            `[系统] 演武结束。本次演武共对木桩造成伤害：${totalDamage.toLocaleString()}`,
          ]);
        }
      }
    }, 150);
    };

    if (isLoading) {
    return (
      <div className="flex min-h-[400px] flex-1 items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="border-ink/20 border-t-crimson h-8 w-8 animate-spin rounded-full border-2" />
          <p className="text-ink/40 text-sm italic">识海构筑中...</p>
        </div>
      </div>
    );
    }

    const handleLeave = () => {

    if (isFighting) {
      if (!confirm('演武尚未结束，确定要强行离去吗？')) return;
    }
    router.push('/game');
  };

  // 进度条辅助组件
  const ProgressBar = ({
    value,
    max,
    color = 'bg-crimson',
  }: {
    value: number;
    max: number;
    color?: string;
  }) => {
    const percent = Math.min(Math.max((value / max) * 100, 0), 100);
    return (
      <div className="bg-ink/5 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={`h-full ${color} transition-all duration-300 ease-out`}
          style={{ width: `${percent}%` }}
        />
      </div>
    );
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-80px)] max-w-2xl flex-col space-y-6 overflow-hidden p-4">
      {/* 头部 */}
      <section className="flex shrink-0 items-center justify-between">
        <div>
          <h1 className="text-ink text-xl font-bold">练功房</h1>
          <p className="text-ink/50 mt-1 text-xs">原始战斗数值测试中</p>
        </div>
        <InkButton onClick={handleLeave} variant="ghost" className="text-sm">
          离开
        </InkButton>
      </section>

      {/* 战斗数值面板 (双血条) */}
      <InkCard variant="elevated" padding="lg" className="shrink-0 space-y-6">
        <div className="flex items-start justify-between gap-8">
          {/* 玩家状态 */}
          <div className="flex-1 space-y-2">
            <div className="flex items-end justify-between">
              <span className="text-ink text-sm font-bold">
                {cultivator?.name || '道友'}
              </span>
              <span className="text-ink/60 text-[10px]">
                {currentSnapshot?.player.hp ?? 0} /{' '}
                {currentSnapshot?.player.maxHp ?? 0}
              </span>
            </div>
            <ProgressBar
              value={currentSnapshot?.player.hp ?? 0}
              max={currentSnapshot?.player.maxHp ?? 0}
            />
            <div className="flex items-center justify-between">
              <span className="text-ink/40 text-[10px] italic">灵力</span>
              <span className="text-ink/60 text-[10px]">
                {currentSnapshot?.player.mp ?? 0}
              </span>
            </div>
          </div>

          <div className="text-ink/20 self-center font-serif text-lg italic">
            VS
          </div>

          {/* 木桩状态 */}
          <div className="flex-1 space-y-2 text-right">
            <div className="flex flex-row-reverse items-end justify-between">
              <span className="text-ink text-sm font-bold">木桩</span>
              <span className="text-ink/60 text-[10px]">
                {currentSnapshot?.opponent.hp ?? DUMMY_HP} / 10亿
              </span>
            </div>
            <ProgressBar
              value={currentSnapshot?.opponent.hp ?? DUMMY_HP}
              max={DUMMY_HP}
              color="bg-ink/40"
            />
            <div className="flex flex-row-reverse items-center justify-between">
              <span className="text-ink/40 text-[10px] italic">灵力</span>
              <span className="text-ink/60 text-[10px]">
                {currentSnapshot?.opponent.mp ?? 0}
              </span>
            </div>
          </div>
        </div>

        {/* 开始按钮 */}
        {!isFighting && (
          <div className="flex justify-center pt-2">
            <InkButton
              onClick={handleStartTraining}
              variant="primary"
              className="px-8 py-2"
            >
              开始演武
            </InkButton>
          </div>
        )}
      </InkCard>

      {/* 日志展示区 */}
      <InkCard variant="plain" className="flex flex-1 flex-col overflow-hidden">
        <div className="mb-3 flex shrink-0 items-center justify-between px-1">
          <h3 className="text-ink/70 text-sm font-bold">演武日志</h3>
          {isFighting && (
            <span className="text-crimson animate-pulse text-base tracking-tighter">
              真元运行中...
            </span>
          )}
        </div>
        <InkDivider className="shrink-0 opacity-10" />
        <div className="text-ink/80 flex-1 space-y-3 overflow-y-auto scroll-smooth px-1 py-4 text-[13px] leading-relaxed">
          {logs.map((log, index) => (
            <div
              key={index}
              className={
                log.startsWith('[系统]')
                  ? 'text-ink/40 italic'
                  : 'border-ink/5 border-l pl-3'
              }
            >
              {log}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </InkCard>
    </div>
  );
}
