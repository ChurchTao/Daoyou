import Link from '@app/components/router/AppLink';
import { useState } from 'react';

type SceneId = 'cave' | 'travel' | 'alchemy' | 'market';

interface SceneAction {
  label: string;
  tone?: 'default' | 'alert';
  apply: (snapshot: DemoSnapshot) => DemoSnapshot;
  result: string;
}

interface SceneDefinition {
  id: SceneId;
  menuLabel: string;
  eyebrow: string;
  title: string;
  intro: string;
  note: string;
  advice: string;
  actions: SceneAction[];
}

interface DemoSnapshot {
  hp: number;
  mp: number;
  cultivation: number;
  insight: number;
  stones: number;
  toxicity: number;
  statuses: string[];
  dispatches: {
    mails: number;
    reports: number;
    rumors: number;
  };
}

const MAX_HP = 480;
const MAX_MP = 220;

const INITIAL_SNAPSHOT: DemoSnapshot = {
  hp: 312,
  mp: 85,
  cultivation: 72,
  insight: 41,
  stones: 1280,
  toxicity: 18,
  statuses: ['轻伤', '丹毒轻染', '经脉滞涩'],
  dispatches: {
    mails: 2,
    reports: 1,
    rumors: 9,
  },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function withStatus(statuses: string[], nextStatus: string) {
  return statuses.includes(nextStatus) ? statuses : [...statuses, nextStatus];
}

function withoutStatus(statuses: string[], target: string) {
  return statuses.filter((status) => status !== target);
}

const SCENES: Record<SceneId, SceneDefinition> = {
  cave: {
    id: 'cave',
    menuLabel: '洞府',
    eyebrow: '主界面 Demo',
    title: '【洞府】',
    intro: '纸窗半启，炉火将熄，昨夜与山魈缠斗后的血腥气仍未散尽。',
    note: '静室中堆着未读玉简，案头残留半页丹谱和一枚未服的回气丹。',
    advice: '此时不宜立刻再战，宜先调息，整顿气机，再决定今日道途。',
    actions: [
      {
        label: '调息复元',
        apply: (snapshot) => ({
          ...snapshot,
          hp: clamp(snapshot.hp + 54, 0, MAX_HP),
          mp: clamp(snapshot.mp + 68, 0, MAX_MP),
          statuses:
            snapshot.hp + 54 >= 360
              ? withoutStatus(snapshot.statuses, '轻伤')
              : snapshot.statuses,
        }),
        result: '你盘膝吐纳三十六周天，气血渐复，经脉涩意稍解。',
      },
      {
        label: '服丹疗伤',
        apply: (snapshot) => ({
          ...snapshot,
          hp: clamp(snapshot.hp + 92, 0, MAX_HP),
          mp: clamp(snapshot.mp + 24, 0, MAX_MP),
          toxicity: clamp(snapshot.toxicity + 7, 0, 100),
          statuses: withoutStatus(
            withStatus(withoutStatus(snapshot.statuses, '轻伤'), '药力翻涌'),
            '经脉滞涩',
          ),
        }),
        result: '丹丸入腹，暖意沿四肢散开，伤势压下去了，药力也一并滞在体内。',
      },
      {
        label: '整顿行囊',
        apply: (snapshot) => ({
          ...snapshot,
          insight: clamp(snapshot.insight + 3, 0, 100),
          dispatches: {
            ...snapshot.dispatches,
            mails: Math.max(0, snapshot.dispatches.mails - 1),
          },
        }),
        result: '你翻检囊中旧物，在一枚破碎玉简背后补全了半句心得。',
      },
    ],
  },
  travel: {
    id: 'travel',
    menuLabel: '云游',
    eyebrow: '行路场景',
    title: '【云游】',
    intro: '山门外雾色低垂，石阶尽头传来商旅和散修交杂的脚步声。',
    note: '远处有一处支线秘境将开，近处则有数名同境修士正在结伴下山。',
    advice: '你气机未满，但若只做短程探索，仍可换来一些见闻与感悟。',
    actions: [
      {
        label: '短程探路',
        apply: (snapshot) => ({
          ...snapshot,
          hp: clamp(snapshot.hp - 24, 0, MAX_HP),
          mp: clamp(snapshot.mp - 18, 0, MAX_MP),
          cultivation: clamp(snapshot.cultivation + 4, 0, 100),
          insight: clamp(snapshot.insight + 6, 0, 100),
          dispatches: {
            ...snapshot.dispatches,
            reports: snapshot.dispatches.reports + 1,
          },
        }),
        result: '你沿古道巡行一段，虽未遇机缘，却摸清了附近敌踪与灵气走向。',
      },
      {
        label: '折返养气',
        apply: (snapshot) => ({
          ...snapshot,
          mp: clamp(snapshot.mp + 36, 0, MAX_MP),
          statuses: withoutStatus(snapshot.statuses, '药力翻涌'),
        }),
        result: '你察觉今日风势不正，未再深行，只在山道边缘吐纳调息。',
      },
      {
        label: '查看战报',
        apply: (snapshot) => ({
          ...snapshot,
          dispatches: {
            ...snapshot.dispatches,
            reports: Math.max(0, snapshot.dispatches.reports - 1),
          },
        }),
        result: '你翻开近日报牒，将附近散修胜败和秘境异象都记进心里。',
      },
    ],
  },
  alchemy: {
    id: 'alchemy',
    menuLabel: '丹房',
    eyebrow: '造化场景',
    title: '【丹房】',
    intro: '黑釉小炉靠墙而立，药臼中还残着半捧尚未筛尽的灵草粉末。',
    note: '案上摆着三味材料与一页旁批，恰好适合拿来试一轮轻量的即兴炼丹。',
    advice: '你现在灵力偏低，宜做小炉试手，不宜强行追求高阶成丹。',
    actions: [
      {
        label: '试炼一炉',
        apply: (snapshot) => ({
          ...snapshot,
          mp: clamp(snapshot.mp - 34, 0, MAX_MP),
          insight: clamp(snapshot.insight + 9, 0, 100),
          cultivation: clamp(snapshot.cultivation + 2, 0, 100),
          toxicity: clamp(snapshot.toxicity + 3, 0, 100),
          statuses: withStatus(snapshot.statuses, '药香萦身'),
        }),
        result: '你借药性和火候推演出一枚半成丹，虽不完美，却补全了几处思路。',
      },
      {
        label: '校阅丹谱',
        apply: (snapshot) => ({
          ...snapshot,
          insight: clamp(snapshot.insight + 5, 0, 100),
        }),
        result: '你把药性归类重誊一遍，几处模糊的药引关系忽然豁然开朗。',
      },
      {
        label: '收炉歇火',
        apply: (snapshot) => ({
          ...snapshot,
          mp: clamp(snapshot.mp + 12, 0, MAX_MP),
          statuses: withoutStatus(snapshot.statuses, '药香萦身'),
        }),
        result: '你按住炉火，让药气慢慢散去，免得心浮时再误手起炉。',
      },
    ],
  },
  market: {
    id: 'market',
    menuLabel: '坊市',
    eyebrow: '交易场景',
    title: '【坊市】',
    intro: '长街人声不断，纸灯下悬着丹药、法器、残卷、妖骨的旧木牌。',
    note: '你身上灵石尚足，但若再乱买，很快就会影响接下来的探索和炼丹节奏。',
    advice: '宜先看价，再决定是补给、捡漏，还是干脆回去把旧物清一轮。',
    actions: [
      {
        label: '补给药材',
        apply: (snapshot) => ({
          ...snapshot,
          stones: Math.max(0, snapshot.stones - 140),
          dispatches: {
            ...snapshot.dispatches,
            mails: snapshot.dispatches.mails + 1,
          },
        }),
        result: '你用灵石换了两味常用药材，顺手收下一张摊主塞来的传音符。',
      },
      {
        label: '寄售旧物',
        apply: (snapshot) => ({
          ...snapshot,
          stones: snapshot.stones + 210,
        }),
        result: '你把两件闲置杂物放上寄售木架，手头顿时宽裕了不少。',
      },
      {
        label: '压价观望',
        tone: 'alert',
        apply: (snapshot) => ({
          ...snapshot,
          insight: clamp(snapshot.insight + 2, 0, 100),
          dispatches: {
            ...snapshot.dispatches,
            rumors: snapshot.dispatches.rumors + 2,
          },
        }),
        result: '你并未急于出手，只沿着街口听了半日风声，顺便记住了几家底价。',
      },
    ],
  },
};

function RuleBar({
  label,
  current,
  max,
  tone,
  suffix,
}: {
  label: string;
  current: number;
  max: number;
  tone: 'hp' | 'mp' | 'progress';
  suffix?: string;
}) {
  const percent = max > 0 ? clamp((current / max) * 100, 0, 100) : 0;
  const toneClass =
    tone === 'hp' ? 'bg-crimson' : tone === 'mp' ? 'bg-teal' : 'bg-ink';

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-3 text-sm leading-6">
        <span className="text-battle-muted shrink-0 tracking-[0.16em]">
          {label}
        </span>
        <span className="text-ink min-w-0 flex-1 truncate text-right font-mono">
          {current} / {max}
          {suffix ? ` ${suffix}` : ''}
        </span>
      </div>
      <div className="bg-battle-faint relative h-[4px] overflow-hidden">
        <div
          className={`${toneClass} h-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function HudMeter({
  label,
  display,
  percent,
  tone,
}: {
  label: string;
  display: string;
  percent: number;
  tone: 'hp' | 'mp' | 'progress' | 'insight';
}) {
  const toneClass =
    tone === 'hp'
      ? 'bg-crimson'
      : tone === 'mp'
        ? 'bg-teal'
        : tone === 'progress'
          ? 'bg-ink'
          : 'bg-wood';

  return (
    <div className="min-w-0 space-y-0.5">
      <div className="flex items-center justify-between gap-2 text-[0.66rem] leading-4 md:text-[0.74rem]">
        <span className="text-battle-muted shrink-0 tracking-[0.12em]">
          {label}
        </span>
        <span className="text-ink shrink-0 text-right font-mono text-[0.7rem] md:text-[0.8rem]">
          {display}
        </span>
      </div>
      <div className="bg-battle-faint h-[3px] min-w-0 overflow-hidden">
        <div
          className={`${toneClass} h-full`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function ActionLink({
  children,
  onClick,
  tone = 'default',
}: {
  children: string;
  onClick: () => void;
  tone?: 'default' | 'alert';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        tone === 'alert'
          ? 'text-crimson hover:text-crimson/80 inline-flex cursor-pointer items-center px-1 py-1 text-[0.95rem] leading-7 tracking-[0.08em]'
          : 'text-ink hover:text-crimson inline-flex cursor-pointer items-center px-1 py-1 text-[0.95rem] leading-7 tracking-[0.08em]'
      }
    >
      〔{children}〕
    </button>
  );
}

export default function GameUiDemoPage() {
  const [sceneId, setSceneId] = useState<SceneId>('cave');
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [resultText, setResultText] = useState(
    '你刚刚从一场遭遇战回到洞府，尚未决定今日的第一步。',
  );
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const scene = SCENES[sceneId];
  const hpPercent = Math.round((snapshot.hp / MAX_HP) * 100);
  const mpPercent = Math.round((snapshot.mp / MAX_MP) * 100);
  const insightPercent = snapshot.insight;
  const statusText = snapshot.statuses.join(' ｜ ') || '安稳无恙';
  const mainAction = scene.actions[0];
  const latestWorldMessage =
    '【世界】白衣剑仙：道友们，幽冥秘境开启，组队刷本缺一擎出，速来！';

  const applySceneAction = (action: SceneAction) => {
    setSnapshot((previous) => action.apply(previous));
    setResultText(action.result);
  };

  const selectScene = (nextSceneId: SceneId) => {
    setSceneId(nextSceneId);
    setIsMenuOpen(false);
    setResultText(`你翻过卷面，主场景切换为${SCENES[nextSceneId].menuLabel}。`);
  };

  return (
    <div className="bg-paper h-screen overflow-hidden">
      <div className="flex h-full flex-col">
        <header className="border-ink/10 border-b border-dashed">
          <button
            type="button"
            onClick={() => setIsProfileOpen(true)}
            className="mx-auto block w-full max-w-5xl px-3 py-1.5 text-left md:px-6 md:py-2"
          >
            <div className="grid grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] gap-2.5 md:gap-5">
              <div className="min-w-0 space-y-0.5">
                <div className="font-heading truncate text-[1.36rem] leading-none md:text-[1.7rem]">
                  林玄
                </div>
                <div className="text-battle-muted truncate text-[0.72rem] leading-4 tracking-[0.12em] md:text-[0.82rem]">
                  筑基中期
                </div>
                <div className="text-crimson truncate text-[0.7rem] leading-4 tracking-[0.14em] md:text-[0.8rem]">
                  「照夜抄经人」
                </div>
                <div className="flex min-w-0 items-baseline gap-1 text-[0.66rem] leading-4 md:text-[0.74rem]">
                  <span className="text-battle-muted shrink-0 tracking-[0.14em]">
                    状态
                  </span>
                  <span className="text-ink truncate">{statusText}</span>
                </div>
              </div>

              <div className="min-w-0 pt-0.5">
                <div className="mb-1 flex items-center justify-end">
                  <div className="shrink-0 text-[0.66rem] tracking-[0.14em] md:text-[0.76rem]">
                    <span className="text-battle-muted mr-1">灵石</span>
                    <span className="text-ink font-mono">
                      {snapshot.stones}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 md:gap-x-4 md:gap-y-2">
                  <HudMeter
                    label="HP"
                    display={`${snapshot.hp}/${MAX_HP}`}
                    percent={hpPercent}
                    tone="hp"
                  />
                  <HudMeter
                    label="MP"
                    display={`${snapshot.mp}/${MAX_MP}`}
                    percent={mpPercent}
                    tone="mp"
                  />
                  <HudMeter
                    label="修为"
                    display={`${snapshot.cultivation}%`}
                    percent={snapshot.cultivation}
                    tone="progress"
                  />
                  <HudMeter
                    label="感悟"
                    display={`${snapshot.insight}/100`}
                    percent={insightPercent}
                    tone="insight"
                  />
                </div>
              </div>
            </div>
          </button>
        </header>

        <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 overflow-hidden">
          <div className="battle-scroll min-h-0 flex-1 overflow-y-auto px-3 py-3 md:px-6 md:py-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <section className="border-battle-rule-strong animate-fade-in border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4 md:px-5 md:py-5">
                <div className="border-battle-rule-strong mb-4 border-b border-dashed pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.72rem] tracking-[0.18em]">
                        <span className="text-battle-muted">场景</span>
                        <span className="text-ink tracking-[0.08em]">
                          {scene.menuLabel}
                        </span>
                        <span className="text-teal tracking-[0.08em]">
                          【静修区域】
                        </span>
                      </div>
                      <div className="mt-2 flex items-end gap-2">
                        <h1 className="text-3xl leading-none md:text-4xl">
                          {scene.title}
                        </h1>
                        <span className="text-battle-muted hidden text-xs tracking-[0.12em] md:inline">
                          固定主场景
                        </span>
                      </div>
                    </div>
                    <Link
                      href="/game"
                      className="text-battle-muted hover:text-ink shrink-0 pt-1 text-xs no-underline transition"
                    >
                      [返回主界面]
                    </Link>
                  </div>
                  <p className="text-ink-secondary mt-3 max-w-2xl text-sm leading-7">
                    {scene.intro}
                  </p>
                </div>

                <div className="space-y-4 text-[1.02rem] leading-8">
                  <p className="text-ink-secondary">{scene.note}</p>
                  <div className="battle-note">
                    <p className="text-sm leading-7">
                      <span className="text-crimson mr-2 tracking-[0.16em]">
                        朱批
                      </span>
                      {scene.advice}
                    </p>
                  </div>
                </div>

                <div className="border-battle-rule-strong mt-5 border-t border-dashed pt-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    行动句
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {scene.actions.map((action) => (
                      <ActionLink
                        key={action.label}
                        tone={action.tone}
                        onClick={() => applySceneAction(action)}
                      >
                        {action.label}
                      </ActionLink>
                    ))}
                    <ActionLink onClick={() => setIsProfileOpen(true)}>
                      查看道身总谱
                    </ActionLink>
                  </div>
                </div>

                <div className="border-battle-rule mt-5 grid gap-4 border-t border-dashed pt-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div>
                    <div className="text-battle-muted mb-2 text-xs tracking-[0.18em]">
                      结果回写
                    </div>
                    <p className="text-sm leading-7">{resultText}</p>
                  </div>
                  <div className="border-battle-rule bg-battle-faint border border-dashed px-3 py-3 text-sm leading-7">
                    <div className="text-battle-muted mb-1 text-xs tracking-[0.18em]">
                      当前摘要
                    </div>
                    <p>
                      气血 {snapshot.hp} / {MAX_HP}
                    </p>
                    <p>
                      真元 {snapshot.mp} / {MAX_MP}
                    </p>
                    <p>修为 {snapshot.cultivation}%</p>
                    <p>道心感悟 {snapshot.insight}</p>
                  </div>
                </div>
              </section>

              <aside className="space-y-4">
                <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    卷边消息
                  </div>
                  <div className="space-y-2 text-sm leading-7">
                    <p>未读玉简 {snapshot.dispatches.mails}</p>
                    <p>新战报 {snapshot.dispatches.reports}</p>
                    <p>世界传音 {snapshot.dispatches.rumors}</p>
                  </div>
                </section>

                <section className="border-battle-rule-strong border border-dashed bg-[rgba(248,243,230,0.88)] px-4 py-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    行途摘要
                  </div>
                  <div className="space-y-2 text-sm leading-7">
                    <p>当前主行动：{mainAction.label}</p>
                    <p>丹毒积存：{snapshot.toxicity} / 100</p>
                    <p>宜先调息，再决定是出行、炼丹，还是整顿行囊。</p>
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </main>

        <footer className="battle-dock border-battle-rule-strong border-t border-dashed">
          <div className="mx-auto max-w-5xl px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.8rem)] md:px-6">
            <div className="border-battle-rule-strong border border-dashed bg-[rgba(239,231,212,0.92)] px-2.5 py-1.5 text-sm leading-6">
              <div className="grid grid-cols-[3.8rem_minmax(0,1fr)] items-start gap-2">
                <span className="text-battle-muted border-battle-rule-strong border-r border-dashed pr-2 text-[0.68rem] tracking-[0.14em]">
                  世界传音
                </span>
                <span className="text-ink min-w-0 flex-1 truncate">
                  {latestWorldMessage}
                </span>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-[repeat(4,minmax(0,1fr))_4rem] items-center gap-1.5 text-[0.76rem] md:text-sm">
              <button
                type="button"
                onClick={() => setIsProfileOpen(true)}
                className="hover:text-crimson px-1 py-1.5 text-center leading-5 whitespace-nowrap"
              >
                [角色]
              </button>
              <button
                type="button"
                onClick={() =>
                  setResultText('你翻开了储物袋，准备整理材料、法宝与丹药。')
                }
                className="hover:text-crimson px-1 py-1.5 text-center leading-5 whitespace-nowrap"
              >
                [储物袋]
              </button>
              <button
                type="button"
                onClick={() =>
                  setResultText('你展开传音玉简，查看最新未读消息与来函。')
                }
                className="hover:text-crimson px-1 py-1.5 text-center leading-5 whitespace-nowrap"
              >
                [传音玉简]
              </button>
              <button
                type="button"
                onClick={() => selectScene('cave')}
                className="hover:text-crimson px-1 py-1.5 text-center leading-5 whitespace-nowrap"
              >
                [洞府]
              </button>
              <button
                type="button"
                onClick={() => setIsMenuOpen((open) => !open)}
                className="hover:text-crimson px-2 py-1.5 text-center tracking-[0.08em] whitespace-nowrap"
              >
                [{isMenuOpen ? '收卷' : '展开'}]
              </button>
            </div>

            {isMenuOpen && (
              <div className="battle-module mt-2 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-dashed pt-2.5 text-sm md:grid-cols-4">
                <div>
                  <div className="text-battle-muted mb-1 text-[0.68rem] tracking-[0.18em]">
                    修行
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 leading-6">
                    <button
                      type="button"
                      onClick={() => selectScene('cave')}
                      className="hover:text-crimson"
                    >
                      [洞府]
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsProfileOpen(true)}
                      className="hover:text-crimson"
                    >
                      [道身总谱]
                    </button>
                    <span className="text-battle-muted">[突破推演]</span>
                  </div>
                </div>

                <div>
                  <div className="text-battle-muted mb-1 text-[0.68rem] tracking-[0.18em]">
                    行路
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 leading-6">
                    <button
                      type="button"
                      onClick={() => selectScene('travel')}
                      className="hover:text-crimson"
                    >
                      [云游]
                    </button>
                    <span className="text-battle-muted">[秘境]</span>
                    <span className="text-battle-muted">[战斗札记]</span>
                  </div>
                </div>

                <div>
                  <div className="text-battle-muted mb-1 text-[0.68rem] tracking-[0.18em]">
                    造化
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 leading-6">
                    <button
                      type="button"
                      onClick={() => selectScene('alchemy')}
                      className="hover:text-crimson"
                    >
                      [丹房]
                    </button>
                    <span className="text-battle-muted">[炼器]</span>
                    <span className="text-battle-muted">[命格]</span>
                  </div>
                </div>

                <div>
                  <div className="text-battle-muted mb-1 text-[0.68rem] tracking-[0.18em]">
                    交易见闻
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 leading-6">
                    <button
                      type="button"
                      onClick={() => selectScene('market')}
                      className="hover:text-crimson"
                    >
                      [坊市]
                    </button>
                    <span className="text-battle-muted">[玉简]</span>
                    <span className="text-battle-muted">[世界传音]</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </footer>
      </div>

      {isProfileOpen && (
        <div className="bg-ink/45 fixed inset-0 z-50 px-4 py-4 md:px-6">
          <div className="bg-paper border-battle-rule-strong battle-scroll mx-auto h-full max-w-4xl overflow-y-auto border border-dashed px-5 py-5">
            <div className="border-battle-rule-strong mb-4 flex items-start justify-between gap-4 border-b border-dashed pb-3">
              <div>
                <div className="text-battle-muted text-[0.72rem] tracking-[0.22em]">
                  点击 HUD 后进入
                </div>
                <h2 className="mt-2 text-3xl">【道身总谱】</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsProfileOpen(false)}
                className="text-battle-muted hover:text-ink shrink-0 text-sm"
              >
                [收起]
              </button>
            </div>

            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
              <div className="space-y-5">
                <section className="border-battle-rule-strong border border-dashed px-4 py-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    当前状态
                  </div>
                  <div className="space-y-3">
                    <RuleBar
                      label="HP"
                      current={snapshot.hp}
                      max={MAX_HP}
                      tone="hp"
                    />
                    <RuleBar
                      label="MP"
                      current={snapshot.mp}
                      max={MAX_MP}
                      tone="mp"
                    />
                    <RuleBar
                      label="修为"
                      current={snapshot.cultivation}
                      max={100}
                      tone="progress"
                      suffix={`感悟 ${snapshot.insight}`}
                    />
                  </div>
                  <div className="border-battle-rule mt-4 grid gap-3 border-t border-dashed pt-3 text-sm leading-7 md:grid-cols-3">
                    <p>灵石：{snapshot.stones}</p>
                    <p>丹毒：{snapshot.toxicity}</p>
                    <p>寿元余量：173</p>
                  </div>
                </section>

                <section className="border-battle-rule-strong border border-dashed px-4 py-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    当前影响
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm leading-7">
                    {snapshot.statuses.map((status) => (
                      <span key={status}>〔{status}〕</span>
                    ))}
                  </div>
                  <p className="text-ink-secondary mt-3 text-sm leading-7">
                    当前以“即时状态 + 长期状态 + 进度轨”为核心，所有摘要都应先在
                    HUD 中被感知，再进入此页深读。
                  </p>
                </section>

                <section className="border-battle-rule-strong border border-dashed px-4 py-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    根骨与命格
                  </div>
                  <div className="space-y-2 text-sm leading-7">
                    <p>灵根：火 86 ｜ 木 63 ｜ 金 25</p>
                    <p>命格：照夜、听潮、迟成</p>
                    <p>破境判辞：可尝试常规突破，但当前感悟略浅。</p>
                  </div>
                </section>
              </div>

              <div className="space-y-5">
                <section className="border-battle-rule-strong border border-dashed px-4 py-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    根基属性
                  </div>
                  <div className="space-y-2 text-sm leading-7">
                    <p>体魄：67</p>
                    <p>灵力：74</p>
                    <p>悟性：58</p>
                    <p>速度：46</p>
                    <p>神识：61</p>
                  </div>
                </section>

                <section className="border-battle-rule-strong border border-dashed px-4 py-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    所修之物
                  </div>
                  <div className="space-y-2 text-sm leading-7">
                    <p>法宝：乌木灯、寒铁短剑、养气佩</p>
                    <p>功法：离火养元诀、山行吐纳篇</p>
                    <p>神通：引火诀、踏叶避锋步</p>
                  </div>
                </section>

                <section className="border-battle-rule-strong border border-dashed px-4 py-4">
                  <div className="text-battle-muted mb-2 text-xs tracking-[0.2em]">
                    这个 Demo 要验证的事
                  </div>
                  <ul className="space-y-2 text-sm leading-7">
                    <li>主界面是否已经像一个“中控台”而不是首页列表。</li>
                    <li>HUD 是否够硬朗，同时不破坏宣纸水墨气质。</li>
                    <li>
                      道身页是否该作为 HUD 的深层展开，而不是另一个孤立功能页。
                    </li>
                  </ul>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
