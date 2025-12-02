'use client';

import { InkButton, InkDivider } from '@/components/InkComponents';
import { InkPageShell } from '@/components/InkLayout';
import { useCultivatorBundle } from '@/lib/hooks/useCultivatorBundle';
import { useMemo, useState } from 'react';

type RitualMode = 'equipment' | 'skill' | 'adventure';

const modes: Record<
  RitualMode,
  {
    title: string;
    actionLabel: string;
    hint: string;
    example: string;
  }
> = {
  equipment: {
    title: '【炼器台 · 请输入炼器意图】',
    actionLabel: '开始炼制',
    hint: '描述材料、属性与命名，炼炉将按意图生成法宝。',
    example: '以千年寒铁铸一柄冰属性长剑，剑名"霜魄"',
  },
  skill: {
    title: '【闭关 · 顿悟神通】',
    actionLabel: '开始顿悟',
    hint: '描述场景或愿景，AI 将生成对应神通。',
    example: '在雷劫中悟得一门攻防一体的雷遁之术',
  },
  adventure: {
    title: '【奇遇 · 推演天机】',
    actionLabel: '触发奇遇',
    hint: '描述想去之地或目标，暂未接入 AI，但会记录意图。',
    example: '求一段药王谷秘境之旅，盼得疗伤灵药',
  },
};

export default function RitualPage() {
  const { cultivator, refresh, note } = useCultivatorBundle();
  const [mode, setMode] = useState<RitualMode>('equipment');
  const [prompt, setPrompt] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [isSubmitting, setSubmitting] = useState(false);

  const currentMode = useMemo(() => modes[mode], [mode]);

  const handleSubmit = async () => {
    if (!cultivator) {
      setStatus('请先在首页觉醒灵根。');
      return;
    }

    if (!prompt.trim() && mode !== 'adventure') {
      setStatus('请先输入你的意图。');
      return;
    }

    setSubmitting(true);
    setStatus('炉火正旺，请稍候……');

    try {
      let endpoint = '';
      const body: Record<string, unknown> = {
        cultivatorId: cultivator.id,
      };

      if (mode === 'equipment') {
        endpoint = '/api/create-equipment';
        body.prompt = prompt;
      } else if (mode === 'skill') {
        endpoint = '/api/create-skill';
        body.prompt = prompt;
      } else {
        endpoint = '/api/generate-adventure';
        body.intent = prompt; // 后端暂未使用，先写入以便后续扩展
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || '仪式失败');
      }

      setStatus(
        mode === 'adventure'
          ? `奇遇：${result.data.adventure.name} —— ${result.data.adventure.result}`
          : `成功！${mode === 'equipment' ? '炼成法宝' : '顿悟神通'}：${result.data.name}`,
      );
      setPrompt('');
      await refresh();
    } catch (error) {
      setStatus(
        error instanceof Error
          ? `此法未成：${error.message}`
          : '仪式失败，请稍后再试。',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <InkPageShell
      title={currentMode.title}
      subtitle=""
      backHref="/"
      note={note}
      footer={
        <div className="flex justify-between text-ink">
          <InkButton href="/">返回</InkButton>
          <span className="text-ink-secondary text-xs">
            AIGC 接口未覆盖的模式将以假数据提示
          </span>
        </div>
      }
    >
      {/* 模式切换 */}
      <div className="mb-4 flex flex-wrap gap-x-3 gap-y-2">
        {Object.entries(modes).map(([key, config]) => {
          const isActive = mode === key;
          return (
            <InkButton
              key={key}
              variant={isActive ? 'primary' : 'default'}
              onClick={() => {
                setMode(key as RitualMode);
                setPrompt('');
                setStatus('');
              }}
              className={isActive ? 'font-semibold' : 'text-sm'}
            >
              {config.title
                .replace(/[【】]/g, '')
                .split('·')[0]
                .trim()}
            </InkButton>
          );
        })}
      </div>

      {/* 输入区域 */}
      <div>
        <div className="mb-4">
          <p className="text-sm text-ink-secondary mb-2">{currentMode.hint}</p>
          <p className="text-sm text-ink-secondary">
            示例：
            <br />
            <span className="text-ink italic">
              &quot;{currentMode.example}&quot;
            </span>
          </p>
        </div>

        <InkDivider />

        <textarea
          className="textarea-large w-full min-h-[40vh] p-4 border border-ink/20 focus:outline-none text-ink placeholder-ink/40 resize-none"
          placeholder="请在此输入你的意图……"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          disabled={isSubmitting}
        />

        <InkDivider />

        <div className="flex justify-end gap-3">
          <InkButton
            onClick={() => {
              setPrompt('');
              setStatus('');
            }}
            disabled={isSubmitting}
          >
            取消
          </InkButton>
          <InkButton
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || (!prompt.trim() && mode !== 'adventure')}
          >
            {isSubmitting ? '运转灵力……' : currentMode.actionLabel}
          </InkButton>
        </div>
      </div>

      {status && (
        <>
          <InkDivider />
          <div className="mt-4 text-center text-sm text-ink">
            {status}
            {mode === 'adventure' && (
              <p className="text-xs text-ink-secondary mt-2">
                【占位】奇遇输入尚未驱动 AI，但意图已记录。
              </p>
            )}
          </div>
        </>
      )}
    </InkPageShell>
  );
}
